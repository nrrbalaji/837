import fs from "fs/promises";
import pool from "../config/database.js";

/**
 * X12 837 EDI Generation Service
 * Converts parsed JSON data back into valid X12 837 EDI claim files
 */

// X12 delimiters (same as parsing)
const SEGMENT_DELIMITER = "~";
const ELEMENT_DELIMITER = "*";
const SUBELEMENT_DELIMITER = ":";

// Date format constants
const DATE_FORMAT = {
  ISO: "YYYY-MM-DD", // Database format (2024-01-15)
  EDI: "CCYYMMDD", // EDI format (20240115)
};

/**
 * Trim trailing element delimiters from segment
 * X12 spec requires removing trailing empty elements
 * Example: "NM1*85*2*ACME****" becomes "NM1*85*2*ACME"
 * Example: "PER*IC*NAME*TE*123***" becomes "PER*IC*NAME*TE*123"
 */
function trimTrailingDelimiters(segment) {
  if (!segment) return segment;

  // Remove trailing element delimiters (*)
  // This handles cases like: "PER*IC*RYCAN*TE*8002013324*EM*edi@rycan.com***"
  while (segment.endsWith(ELEMENT_DELIMITER)) {
    segment = segment.slice(0, -1);
  }

  return segment;
}

/**
 * Fetch corrected claim data from database and prepare for generation
 * @param {number} claimId - The claim ID from database
 * @param {number} fileId - The original file ID for envelope data
 * @returns {Promise<Object>} Generation-ready parsed data structure
 */
export async function getGenerationReadyData(claimId, fileId) {
  const client = await pool.connect();

  try {
    // Fetch the original file's envelope data (ISA, GS, ST)
    const fileResult = await client.query(
      `SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1`,
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      throw new Error(`File ${fileId} not found`);
    }

    const originalParsed = fileResult.rows[0].parsed_json;

    // Fetch the claim with all corrections applied
    const claimResult = await client.query(
      `
      SELECT
        ch.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.middle_name as patient_middle_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        p.address_line1 as patient_address1,
        p.address_line2 as patient_address2,
        p.city as patient_city,
        p.state as patient_state,
        p.zip_code as patient_zip,
        f.facility_name,
        f.npi as facility_npi,
        f.tax_id as facility_tax_id,
        f.address_line1 as facility_address1,
        f.city as facility_city,
        f.state as facility_state,
        f.zip_code as facility_zip,
        pr.first_name as provider_first_name,
        pr.last_name as provider_last_name,
        pr.npi as provider_npi,
        py.payer_name,
        py.electronic_payer_id
      FROM ClaimHeader ch
      LEFT JOIN Patient p ON ch.patient_id = p.patient_id
      LEFT JOIN Facilities f ON ch.facility_id = f.facility_id
      LEFT JOIN Provider pr ON ch.provider_id = pr.provider_id
      LEFT JOIN Payer py ON ch.payer_id = py.payer_id
      WHERE ch.claim_id = $1
    `,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const claim = claimResult.rows[0];

    // Fetch service lines
    const linesResult = await client.query(
      `SELECT * FROM ClaimLine WHERE claim_id = $1 ORDER BY line_number`,
      [claimId]
    );

    // Fetch diagnoses
    const diagnosesResult = await client.query(
      `SELECT * FROM ClaimDiagnosis WHERE claim_id = $1 ORDER BY diagnosis_sequence`,
      [claimId]
    );

    // Build generation-ready structure matching the parsed format
    const generationData = {
      isa: originalParsed.isa,
      gs: originalParsed.gs,
      st: originalParsed.st,
      ge: originalParsed.ge,
      iea: originalParsed.iea,
      claims: [
        {
          bht: originalParsed.claims[0]?.bht || {
            hierarchicalStructureCode: "0019",
            transactionSetPurposeCode: "00",
            referenceIdentification: claim.claim_number,
            date:
              normalizeDate(claim.service_date_from) ||
              formatDateToCCYYMMDD(new Date()),
            time: formatTimeToHHMM(new Date()),
            transactionTypeCode: "CH",
          },
          submitter: originalParsed.claims[0]?.submitter || {},
          receiver: {
            entityIdentifierCode: "40",
            entityTypeQualifier: "2",
            lastName: claim.payer_name || "PAYER",
            identificationCodeQualifier: "46",
            identificationCode: claim.electronic_payer_id || "",
          },
          billing: {
            entityIdentifierCode: "85",
            entityTypeQualifier: "2",
            lastName: claim.facility_name || "",
            identificationCodeQualifier: "XX",
            identificationCode: claim.facility_npi || "",
            taxId: claim.facility_tax_id || "",
            addressLine1: claim.facility_address1 || "",
            city: claim.facility_city || "",
            state: claim.facility_state || "",
            zipCode: claim.facility_zip || "",
          },
          subscriber: {
            entityIdentifierCode: "IL",
            entityTypeQualifier: "1",
            lastName: claim.patient_last_name || "",
            firstName: claim.patient_first_name || "",
            middleName: claim.patient_middle_name || "",
            identificationCodeQualifier: "MI",
            identificationCode: claim.claim_number || "",
            dateOfBirth: claim.patient_dob,
            gender: claim.patient_gender,
            addressLine1: claim.patient_address1,
            addressLine2: claim.patient_address2,
            city: claim.patient_city,
            state: claim.patient_state,
            zipCode: claim.patient_zip,
          },
          patient: {
            entityIdentifierCode: "QC",
            entityTypeQualifier: "1",
            lastName: claim.patient_last_name || "",
            firstName: claim.patient_first_name || "",
            middleName: claim.patient_middle_name || "",
            dateOfBirth: claim.patient_dob,
            gender: claim.patient_gender,
            addressLine1: claim.patient_address1,
            addressLine2: claim.patient_address2,
            city: claim.patient_city,
            state: claim.patient_state,
            zipCode: claim.patient_zip,
          },
          payer: {
            entityIdentifierCode: "PR",
            entityTypeQualifier: "2",
            lastName: claim.payer_name || "",
            identificationCodeQualifier: "PI",
            identificationCode: claim.electronic_payer_id || "",
          },
          renderingProvider: claim.provider_npi
            ? {
                entityIdentifierCode: "82",
                entityTypeQualifier: "1",
                lastName: claim.provider_last_name || "",
                firstName: claim.provider_first_name || "",
                identificationCodeQualifier: "XX",
                identificationCode: claim.provider_npi,
              }
            : null,
          subscriberInfo: {
            payerResponsibilitySequence: "P",
            individualRelationshipCode: "18",
            claimFilingIndicatorCode: "CI",
          },
          serviceDateFrom: claim.service_date_from,
          serviceDateTo: claim.service_date_to,
          statementDateFrom: claim.statement_date,
          statementDateTo: claim.statement_date,
          admissionDate: claim.admission_date,
          dischargeDate: claim.discharge_date,
          claims: [
            {
              claimNumber: claim.claim_number,
              totalCharge: parseFloat(claim.total_charge) || 0,
              placeOfService: claim.place_of_service,
              claimFrequencyCode: claim.claim_frequency_code || "1",
              facilityCodeQualifier: "B",
              providerSignatureIndicator: "Y",
              assignmentOfBenefitsIndicator: "A",
              benefitsAssignmentCertification: "Y",
              releaseOfInformationCode: "Y",
              diagnoses: diagnosesResult.rows.map((diag) => ({
                codeListQualifier: diag.diagnosis_type || "ABK",
                code: diag.diagnosis_code,
                sequence: diag.diagnosis_sequence,
                isPrimary: diag.is_principal || false, // Map is_principal from database
              })),
              serviceLines: linesResult.rows.map((line) => ({
                serviceLineType: line.revenue_code ? "SV2" : "SV1",
                revenueCode: line.revenue_code || null,
                procedureCodeQualifier: "HC",
                procedureCode: line.procedure_code,
                procedureModifier1: line.procedure_modifier1,
                procedureModifier2: line.procedure_modifier2,
                procedureModifier3: line.procedure_modifier3,
                procedureModifier4: line.procedure_modifier4,
                lineItemCharge: parseFloat(line.total_charge) || 0,
                unitOrBasisMeasurement: "UN",
                serviceUnitCount: parseFloat(line.quantity) || 1,
                placeOfService: line.place_of_service || claim.place_of_service,
                diagnosisCodePointer: line.diagnosis_pointer,
                serviceDateFrom: line.service_date_from,
                serviceDateTo: line.service_date_to,
              })),
            },
          ],
        },
      ],
    };

    return generationData;
  } finally {
    client.release();
  }
}

/**
 * Main function to generate X12 837 EDI file from parsed JSON data
 * @param {Object} parsedData - JSON object from parseX12Content() or UploadFileDetail.parsed_json
 * @param {string} outputPath - Optional path to save the generated .837 file
 * @returns {Promise<string>} The complete EDI content as string
 */
export async function generate837File(parsedData, outputPath) {
  try {
    console.log("\n=== Starting 837 File Generation ===");

    // Validate input data
    if (!parsedData) {
      throw new Error("parsedData is required");
    }

    if (!parsedData.isa) {
      throw new Error("Missing ISA (Interchange Control Header) data");
    }

    if (!parsedData.gs) {
      throw new Error("Missing GS (Functional Group Header) data");
    }

    if (!parsedData.st) {
      throw new Error("Missing ST (Transaction Set Header) data");
    }

    if (!parsedData.claims || parsedData.claims.length === 0) {
      throw new Error("No claims found in parsed data");
    }

    console.log(`Processing ${parsedData.claims.length} claim(s)...`);

    const segments = [];

    // ========================================================================
    // BUILD INTERCHANGE CONTROL HEADER (ISA)
    // ========================================================================
    console.log("Building ISA segment...");
    segments.push(buildISA(parsedData.isa));

    // ========================================================================
    // BUILD FUNCTIONAL GROUP HEADER (GS)
    // ========================================================================
    console.log("Building GS segment...");
    segments.push(buildGS(parsedData.gs));

    // ========================================================================
    // BUILD TRANSACTION SET HEADER (ST)
    // ========================================================================
    console.log("Building ST segment...");
    segments.push(buildST(parsedData.st));

    // ========================================================================
    // BUILD HIERARCHICAL TRANSACTION (BHT) & CLAIM LOOPS
    // ========================================================================
    console.log("Building claim loops...");

    let claimIndex = 0;
    for (const claimData of parsedData.claims || []) {
      claimIndex++;
      console.log(
        `  Processing claim ${claimIndex}/${parsedData.claims.length}...`
      );

      // Mark the start of this transaction set (ST is already added above)
      const transactionStartIndex = segments.findIndex((s) =>
        s.startsWith("ST")
      );

      if (transactionStartIndex === -1) {
        throw new Error("ST segment not found - invalid segment structure");
      }

      // Validate claim data
      if (!claimData.claims || claimData.claims.length === 0) {
        console.warn(`    ⚠ Warning: Claim ${claimIndex} has no claim details`);
        continue;
      }

      const claim = claimData.claims[0];
      const serviceLineCount = claim.serviceLines?.length || 0;
      const diagnosisCount = claim.diagnoses?.length || 0;

      console.log(`    Claim #: ${claim.claimNumber || "N/A"}`);
      console.log(`    Total Charge: $${claim.totalCharge || 0}`);
      console.log(`    Service Lines: ${serviceLineCount}`);
      console.log(`    Diagnoses: ${diagnosisCount}`);

      // BHT segment
      segments.push(buildBHT(claimData.bht));

      // Build the complete claim loop (all HL levels, entities, claims, service lines)
      try {
        const claimSegments = buildClaimLoop(claimData);
        segments.push(...claimSegments);
        console.log(
          `    ✓ Generated ${claimSegments.length} segments for this claim`
        );
      } catch (claimError) {
        console.error(`    ✗ Error building claim loop:`, claimError.message);
        throw new Error(
          `Failed to build claim ${claimIndex}: ${claimError.message}`
        );
      }

      // SE (Transaction Set Trailer) - counts segments from ST to SE inclusive
      // Count includes ST, BHT, all claim segments, and SE itself
      const segmentCountInTransaction =
        segments.length - transactionStartIndex + 1; // +1 for SE segment itself
      segments.push(
        buildSE(
          parsedData.st?.transactionSetControlNumber || "0001",
          segmentCountInTransaction
        )
      );

      console.log(`    SE segment count: ${segmentCountInTransaction}`);
    }

    // ========================================================================
    // BUILD FUNCTIONAL GROUP TRAILER (GE)
    // ========================================================================
    console.log("Building GE segment...");
    const transactionSetCount = parsedData.claims?.length || 1;
    segments.push(
      buildGE(transactionSetCount, parsedData.gs?.groupControlNumber || "1")
    );

    // ========================================================================
    // BUILD INTERCHANGE CONTROL TRAILER (IEA)
    // ========================================================================
    console.log("Building IEA segment...");
    segments.push(
      buildIEA(
        parsedData.iea?.numberOfFunctionalGroups || 1,
        parsedData.isa?.interchangeControlNumber || "000000001"
      )
    );

    // ========================================================================
    // JOIN SEGMENTS AND RETURN EDI CONTENT
    // ========================================================================
    console.log("\nAssembling EDI content...");
    console.log(`Total segments: ${segments.length}`);

    const ediContent =
      segments.join(SEGMENT_DELIMITER + "\n") + SEGMENT_DELIMITER; // Add final newline for each segment on separate line

    const fileSizeKB = (ediContent.length / 1024).toFixed(2);
    console.log(`EDI content size: ${fileSizeKB} KB`);

    // ========================================================================
    // WRITE TO FILE IF OUTPUT PATH PROVIDED
    // ========================================================================
    const path = await import("path");
    const dir = path.default.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    if (outputPath) {
      console.log(`Writing to file: ${outputPath}`);
      await fs.writeFile(outputPath, ediContent, "utf8");
      console.log(`✅ 837 file generated successfully: ${outputPath}`);
    }

    console.log("=== Generation Complete ===\n");

    return ediContent;
  } catch (error) {
    console.error("\n❌ Error generating 837 file:");
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split("\n")[1]?.trim()}`);
    }
    throw error;
  }
}

/**
 * Build ISA segment (Interchange Control Header)
 * ISA*01*02*03*04*05*06*07*08*09*10*11*12*13*14*15*16~
 */
function buildISA(isa) {
  const elements = [
    "ISA", // Segment ID
    isa?.authorizationQualifier || "00", // 01
    (isa?.authorizationInformation || "").padEnd(10, " "), // 02 (10 chars)
    isa?.securityQualifier || "00", // 03
    (isa?.securityInformation || "").padEnd(10, " "), // 04 (10 chars)
    isa?.interchangeIdQualifier || "ZZ", // 05
    (isa?.interchangeSenderId || "SENDERID").padEnd(15, " "), // 06 (15 chars)
    isa?.interchangeIdQualifier2 || "ZZ", // 07
    (isa?.interchangeReceiverId || "RECEIVERID").padEnd(15, " "), // 08 (15 chars)
    isa?.interchangeDate || formatDateToCCYYMMDD(new Date()), // 09 (6 chars CCYYMMDD)
    isa?.interchangeTime || formatTimeToHHMM(new Date()), // 10 (4 chars HHMM)
    isa?.interchangeControlStandards || "^", // 11
    isa?.interchangeControlVersion || "00501", // 12
    (isa?.interchangeControlNumber || "000000001").padStart(9, "0"), // 13 (9 chars)
    isa?.acknowledgmentRequested || "0", // 14
    isa?.usageIndicator || "T", // 15
    isa?.componentElementSeparator || ":", // 16
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build GS segment (Functional Group Header)
 * GS*01*02*03*04*05*06*07*08~
 */
function buildGS(gs) {
  const elements = [
    "GS", // Segment ID
    gs?.functionalIdentifierCode || "HC", // 01
    gs?.applicationSenderCode || "SENDERID", // 02
    gs?.applicationReceiverCode || "RECEIVERID", // 03
    gs?.date || formatDateToCCYYMMDD(new Date()), // 04 (8 chars CCYYMMDD)
    gs?.time || formatTimeToHHMM(new Date()), // 05 (4 chars HHMM)
    gs?.groupControlNumber || "1", // 06
    gs?.responsibleAgencyCode || "X", // 07
    gs?.versionReleaseIndustryCode || "005010X222A1", // 08
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build ST segment (Transaction Set Header)
 * ST*01*02*03~
 */
function buildST(st) {
  const elements = [
    "ST", // Segment ID
    st?.transactionSetIdentifierCode || "837", // 01
    (st?.transactionSetControlNumber || "0001").padStart(4, "0"), // 02
    st?.implementationConventionReference || "005010X222A1", // 03
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build BHT segment (Beginning of Hierarchical Transaction)
 * BHT*01*02*03*04*05*06~
 */
function buildBHT(bht) {
  const elements = [
    "BHT", // Segment ID
    bht?.hierarchicalStructureCode || "0019", // 01
    bht?.transactionSetPurposeCode || "00", // 02
    bht?.referenceIdentification || "1", // 03
    bht?.date || formatDateToCCYYMMDD(new Date()), // 04 (8 chars CCYYMMDD)
    bht?.time || formatTimeToHHMM(new Date()), // 05 (4 chars HHMM)
    bht?.transactionTypeCode || "CH", // 06
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build complete claim loop including hierarchical levels, entities, claim, and service lines
 */
function buildClaimLoop(claimData) {
  const segments = [];
  let hierarchicalIdNumber = 1;

  // Track parent IDs for HL segments
  let billingProviderId = hierarchicalIdNumber++;

  // ========================================================================
  // SUBMITTER LOOP
  // ========================================================================
  if (claimData.submitter) {
    segments.push(buildNM1(claimData.submitter, "41")); // Submitter

    // Address (if available)
    if (
      claimData.submitter.addressLine1 ||
      claimData.submitter.address?.addressLine1
    ) {
      segments.push(buildN3(claimData.submitter));
    }
    if (claimData.submitter.city || claimData.submitter.address?.city) {
      segments.push(buildN4(claimData.submitter));
    }

    // PER segment for submitter contact (not required but common)
    if (
      claimData.submitter.contacts &&
      claimData.submitter.contacts.length > 0
    ) {
      segments.push(buildPER(claimData.submitter.contacts[0]));
    }
  }

  // ========================================================================
  // RECEIVER LOOP (PAYER)
  // ========================================================================
  if (claimData.receiver) {
    segments.push(buildNM1(claimData.receiver, "40")); // Receiver

    // Address (if available)
    if (
      claimData.receiver.addressLine1 ||
      claimData.receiver.address?.addressLine1
    ) {
      segments.push(buildN3(claimData.receiver));
    }
    if (claimData.receiver.city || claimData.receiver.address?.city) {
      segments.push(buildN4(claimData.receiver));
    }
  }

  // ========================================================================
  // BILLING PROVIDER HL LOOP
  // ========================================================================
  segments.push(buildHL(billingProviderId, "", "20", "1")); // Billing Provider HL

  if (claimData.billing) {
    segments.push(buildNM1(claimData.billing, "85")); // Billing Provider

    // Address
    if (claimData.billing.addressLine1) {
      segments.push(buildN3(claimData.billing));
    }
    if (claimData.billing.city) {
      segments.push(buildN4(claimData.billing));
    }

    // References (Tax ID)
    if (claimData.billing.taxId) {
      segments.push(buildREF("EI", claimData.billing.taxId));
    }

    // PRV segment for billing provider
    if (claimData.billing.providerInfo) {
      segments.push(buildPRV(claimData.billing.providerInfo));
    }
  }

  // ========================================================================
  // REFERRING PROVIDER (DN)
  // ========================================================================
  if (claimData.referringProvider) {
    segments.push(buildNM1(claimData.referringProvider, "DN")); // Referring Provider

    // Address (if available)
    if (
      claimData.referringProvider.addressLine1 ||
      claimData.referringProvider.address?.addressLine1
    ) {
      segments.push(buildN3(claimData.referringProvider));
    }
    if (
      claimData.referringProvider.city ||
      claimData.referringProvider.address?.city
    ) {
      segments.push(buildN4(claimData.referringProvider));
    }

    // PRV segment for referring provider
    if (claimData.referringProvider.providerInfo) {
      segments.push(buildPRV(claimData.referringProvider.providerInfo));
    }
  }

  // ========================================================================
  // RENDERING PROVIDER (82)
  // ========================================================================
  if (claimData.renderingProvider) {
    segments.push(buildNM1(claimData.renderingProvider, "82")); // Rendering Provider

    // Address (if available)
    if (
      claimData.renderingProvider.addressLine1 ||
      claimData.renderingProvider.address?.addressLine1
    ) {
      segments.push(buildN3(claimData.renderingProvider));
    }
    if (
      claimData.renderingProvider.city ||
      claimData.renderingProvider.address?.city
    ) {
      segments.push(buildN4(claimData.renderingProvider));
    }

    // PRV segment for rendering provider
    if (claimData.renderingProvider.providerInfo) {
      segments.push(buildPRV(claimData.renderingProvider.providerInfo));
    }
  }

  // ========================================================================
  // SERVICE FACILITY LOCATION (77)
  // ========================================================================
  if (claimData.serviceFacility) {
    segments.push(buildNM1(claimData.serviceFacility, "77")); // Service Facility Location

    // Address for service facility
    if (claimData.serviceFacility.addressLine1) {
      segments.push(buildN3(claimData.serviceFacility));
    }
    if (claimData.serviceFacility.city) {
      segments.push(buildN4(claimData.serviceFacility));
    }
  }

  // ========================================================================
  // SUBSCRIBER HL LOOP
  // ========================================================================
  let subscriberId = hierarchicalIdNumber++;
  segments.push(
    buildHL(
      subscriberId,
      billingProviderId,
      "22",
      claimData.patient ? "1" : "0"
    )
  ); // Subscriber HL

  segments.push(buildSBR(claimData.subscriberInfo)); // Subscriber Information

  if (claimData.subscriber) {
    segments.push(buildNM1(claimData.subscriber, "IL")); // Subscriber Name

    // Address
    if (claimData.subscriber.addressLine1) {
      segments.push(buildN3(claimData.subscriber));
    }
    if (claimData.subscriber.city) {
      segments.push(buildN4(claimData.subscriber));
    }

    // Demographics
    if (claimData.subscriber.dateOfBirth) {
      segments.push(buildDMG(claimData.subscriber));
    }
  }

  // Payer for subscriber
  if (claimData.payer) {
    segments.push(buildNM1(claimData.payer, "PR")); // Payer Name

    // Address (if available)
    if (claimData.payer.addressLine1 || claimData.payer.address?.addressLine1) {
      segments.push(buildN3(claimData.payer));
    }
    if (claimData.payer.city || claimData.payer.address?.city) {
      segments.push(buildN4(claimData.payer));
    }
  }

  // ========================================================================
  // PATIENT HL LOOP (only if different from subscriber)
  // ========================================================================
  if (
    claimData.patient &&
    claimData.subscriberInfo?.individualRelationshipCode !== "18"
  ) {
    let patientId = hierarchicalIdNumber++;
    segments.push(buildHL(patientId, subscriberId, "23", "0")); // Patient HL

    segments.push(buildNM1(claimData.patient, "QC")); // Patient Name

    // Address
    if (claimData.patient.addressLine1) {
      segments.push(buildN3(claimData.patient));
    }
    if (claimData.patient.city) {
      segments.push(buildN4(claimData.patient));
    }

    // Demographics
    if (claimData.patient.dateOfBirth) {
      segments.push(buildDMG(claimData.patient));
    }
  }

  // ========================================================================
  // CLAIMS
  // ========================================================================
  for (const claim of claimData.claims || []) {
    segments.push(buildCLM(claim)); // Claim Header

    // Statement dates (DTP*434 - Statement From/To)
    if (claimData.statementDateFrom) {
      const dtpSegment = buildDTP(
        "434",
        claimData.statementDateFrom,
        claimData.statementDateTo
      );
      if (dtpSegment) segments.push(dtpSegment);
    }

    // Service dates (DTP*472 - Service From/To)
    if (claimData.serviceDateFrom) {
      const dtpSegment = buildDTP(
        "472",
        claimData.serviceDateFrom,
        claimData.serviceDateTo
      );
      if (dtpSegment) segments.push(dtpSegment);
    }

    // Admission date (DTP*435 - Admission)
    if (claimData.admissionDate) {
      const dtpSegment = buildDTP("435", claimData.admissionDate);
      if (dtpSegment) segments.push(dtpSegment);
    }

    // Discharge date (DTP*096 - Discharge)
    if (claimData.dischargeDate) {
      const dtpSegment = buildDTP("096", claimData.dischargeDate);
      if (dtpSegment) segments.push(dtpSegment);
    }

    // Prior authorization number (REF*G1)
    if (claimData.priorAuthNumber) {
      segments.push(buildREF("G1", claimData.priorAuthNumber));
    }

    // Additional references
    if (claimData.references && Array.isArray(claimData.references)) {
      for (const ref of claimData.references) {
        if (ref.referenceQualifier && ref.referenceIdentification) {
          segments.push(
            buildREF(
              ref.referenceQualifier,
              ref.referenceIdentification,
              ref.description
            )
          );
        }
      }
    }

    // Diagnoses - Build separate HI segments for primary and secondary diagnoses
    if (claim.diagnoses && claim.diagnoses.length > 0) {
      const hiSegments = buildHI(claim.diagnoses);
      segments.push(...hiSegments);
    }

    // CL1 - Institutional Claim Code (for 837I institutional claims)
    if (claim.cl1) {
      segments.push(buildCL1(claim.cl1));
    }

    // ========================================================================
    // SERVICE LINES
    // ========================================================================
    for (let i = 0; i < claim.serviceLines.length; i++) {
      const serviceLine = claim.serviceLines[i];

      segments.push(buildLX(i + 1)); // Service Line Number
      segments.push(buildServiceLine(serviceLine)); // SV1 or SV2 segment

      // Service dates for line (if different from claim level)
      if (serviceLine.serviceDateFrom) {
        const dtpSegment = buildDTP(
          "472",
          serviceLine.serviceDateFrom,
          serviceLine.serviceDateTo
        );
        if (dtpSegment) segments.push(dtpSegment);
      }
    }
  }

  return segments;
}

/**
 * Build NM1 segment (Name)
 * NM1*01*02*03*04*05*06*07*08*09~
 */
function buildNM1(entity, entityIdentifierCode) {
  const elements = [
    "NM1", // Segment ID
    entityIdentifierCode || "85", // 01 - Entity Identifier Code
    entity?.entityTypeQualifier || "2", // 02 - Entity Type Qualifier (1=Person, 2=Non-Person)
    entity?.lastName || "", // 03 - Last Name or Organization Name
    entity?.firstName || "", // 04 - First Name
    entity?.middleName || "", // 05 - Middle Name
    entity?.namePrefix || "", // 06 - Name Prefix
    entity?.nameSuffix || "", // 07 - Name Suffix
    entity?.identificationCodeQualifier || "XX", // 08 - Identification Code Qualifier
    entity?.identificationCode || "", // 09 - Identification Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build HL segment (Hierarchical Level)
 * HL*01*02*03*04~
 */
function buildHL(hierarchicalIdNumber, parentId, levelCode, childCode) {
  const elements = [
    "HL", // Segment ID
    hierarchicalIdNumber, // 01 - Hierarchical ID Number
    parentId || "", // 02 - Hierarchical Parent ID Number
    levelCode || "20", // 03 - Hierarchical Level Code
    childCode || "1", // 04 - Hierarchical Child Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build PER segment (Contact Information)
 * PER*01*02*03*04*05*06*07*08*09~
 */
function buildPER(contact) {
  const elements = [
    "PER", // Segment ID
    contact?.functionCode || "IC", // 01 - Contact Function Code (IC=Information Contact, BL=Billing Contact)
    contact?.name || "", // 02 - Name
    contact?.communicationQualifier1 || "TE", // 03 - Communication Number Qualifier 1 (TE=Telephone, FX=Fax, EM=Email)
    contact?.communicationNumber1 || "", // 04 - Communication Number 1
    contact?.communicationQualifier2 || "", // 05 - Communication Number Qualifier 2
    contact?.communicationNumber2 || "", // 06 - Communication Number 2
    contact?.communicationQualifier3 || "", // 07 - Communication Number Qualifier 3
    contact?.communicationNumber3 || "", // 08 - Communication Number 3
    contact?.contactInquiryReference || "", // 09 - Contact Inquiry Reference
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build REF segment (Reference Identification)
 * REF*01*02*03~
 */
function buildREF(referenceQualifier, referenceId, description = "") {
  const elements = [
    "REF", // Segment ID
    referenceQualifier || "EI", // 01 - Reference Identification Qualifier
    referenceId || "", // 02 - Reference Identification
    description || "", // 03 - Description
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build PRV segment (Provider Information)
 * PRV*01*02*03~
 */
function buildPRV(providerInfo) {
  const elements = [
    "PRV", // Segment ID
    providerInfo?.providerCode || "PE", // 01 - Provider Code (PE=Performing, RF=Referring, AT=Attending, BI=Billing)
    providerInfo?.referenceIdentificationQualifier || "PXC", // 02 - Reference Identification Qualifier (PXC=Health Care Provider Taxonomy Code)
    providerInfo?.providerTaxonomyCode || "", // 03 - Provider Taxonomy Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build N3 segment (Address Line)
 * N3*01*02~
 * Supports both nested address object and top-level properties for backward compatibility
 */
function buildN3(entity) {
  // Check for nested address object first, then fall back to top-level properties
  const addressLine1 =
    entity?.address?.addressLine1 || entity?.addressLine1 || "";
  const addressLine2 =
    entity?.address?.addressLine2 || entity?.addressLine2 || "";

  const elements = [
    "N3", // Segment ID
    addressLine1, // 01 - Address Line 1
    addressLine2, // 02 - Address Line 2
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build N4 segment (City, State, ZIP)
 * N4*01*02*03*04~
 * Supports both nested address object and top-level properties for backward compatibility
 */
function buildN4(entity) {
  // Check for nested address object first, then fall back to top-level properties
  const city = entity?.address?.city || entity?.city || "";
  const state = entity?.address?.state || entity?.state || "";
  const zipCode = entity?.address?.zipCode || entity?.zipCode || "";
  const countryCode = entity?.address?.countryCode || entity?.countryCode || "";

  const elements = [
    "N4", // Segment ID
    city, // 01 - City Name
    state, // 02 - State or Province Code
    zipCode, // 03 - Postal Code
    countryCode, // 04 - Country Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build DMG segment (Demographics)
 * DMG*01*02*03~
 */
function buildDMG(entity) {
  let dateOfBirth = "";
  if (entity.dateOfBirth) {
    // Convert from YYYY-MM-DD to CCYYMMDD if needed
    dateOfBirth = normalizeDate(entity.dateOfBirth);
  }

  const elements = [
    "DMG", // Segment ID
    "D8", // 01 - Date Time Period Format Qualifier
    dateOfBirth, // 02 - Date Time Period
    entity?.gender || "", // 03 - Gender Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build CL1 segment (Institutional Claim Code)
 * CL1*01*02*03*04~
 * Used for 837I (Institutional) claims to specify admission type, source, and patient status
 */
function buildCL1(cl1Data) {
  const elements = [
    "CL1", // Segment ID
    cl1Data?.admissionTypeCode || "", // 01 - Admission Type Code
    cl1Data?.admissionSourceCode || "", // 02 - Admission Source Code
    cl1Data?.patientStatusCode || "", // 03 - Patient Status Code
    cl1Data?.nursingHomeResidentialStatusCode || "", // 04 - Nursing Home Residential Status Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build CLM segment (Claim Information)
 * CLM*01*02*03*04*05*06*07*08*09~
 */
function buildCLM(claim) {
  // Build facility code qualifier composite (placeOfService:facilityCodeQualifier:claimFrequencyCode)
  const facilityCodeQualifier = claim.placeOfService
    ? `${claim.placeOfService}:${claim.facilityCodeQualifier || ""}:${
        claim.claimFrequencyCode || "1"
      }`
    : "11:B:1";

  const elements = [
    "CLM", // Segment ID
    claim?.claimNumber || "1", // 01 - Claim Submitter's Identifier
    formatAmount(claim?.totalCharge || 0), // 02 - Monetary Amount
    "", // 03 - Claim Filing Indicator Code (not used)
    "", // 04 - Non-Institutional Claim Type Code (not used)
    facilityCodeQualifier, // 05 - Facility Code Value
    claim?.providerSignatureIndicator || "Y", // 06 - Provider or Supplier Signature Indicator
    claim?.assignmentOfBenefitsIndicator || "A", // 07 - Assignment or Plan Participation Code
    claim?.benefitsAssignmentCertification || "Y", // 08 - Benefits Assignment Certification Indicator
    claim?.releaseOfInformationCode || "Y", // 09 - Release of Information Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build DTP segment (Date or Time or Period)
 * DTP*01*02*03~
 */
function buildDTP(dateQualifier, dateFrom, dateTo = null) {
  let dateFormat = "D8"; // Default single date
  let dateValue = "";

  // Normalize dates to CCYYMMDD format
  const normalizedFrom = normalizeDate(dateFrom);
  const normalizedTo = dateTo ? normalizeDate(dateTo) : null;

  if (normalizedFrom && normalizedTo && normalizedFrom !== normalizedTo) {
    // Date range
    dateFormat = "RD8";
    dateValue = `${normalizedFrom}-${normalizedTo}`;
  } else if (normalizedFrom) {
    // Single date
    dateValue = normalizedFrom;
  }

  // Skip if no valid date
  if (!dateValue) {
    return null;
  }

  const elements = [
    "DTP", // Segment ID
    dateQualifier || "472", // 01 - Date/Time Qualifier
    dateFormat, // 02 - Date Time Period Format Qualifier
    dateValue, // 03 - Date Time Period
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build HI segment (Health Care Diagnosis Code)
 * HI segment structure: HI*qualifier:code:date:amount:quantity:conditionCode:occurrenceCode:isPrincipal*...*
 * Each element can contain up to 8 subelements providing detailed diagnosis information
 * Returns array of HI segments - primary diagnosis on separate line with 'Y' indicator
 */
function buildHI(diagnoses) {
  const segments = []; // Array of HI segments

  console.log("=== Building HI Segments (Health Care Diagnosis Code) ===");
  console.log("Total Diagnoses:", diagnoses.length);

  // Separate primary and secondary diagnoses
  const primaryDiagnoses = diagnoses.filter(
    (diag, index) =>
      diag.isPrimary === true || (index === 0 && diag.isPrimary !== false)
  );
  const secondaryDiagnoses = diagnoses.filter(
    (diag, index) =>
      diag.isPrimary === false || (index > 0 && diag.isPrimary !== true)
  );

  console.log(`  - Primary Diagnoses: ${primaryDiagnoses.length}`);
  console.log(`  - Secondary Diagnoses: ${secondaryDiagnoses.length}`);

  // Build HI segment for primary diagnosis (if exists)
  if (primaryDiagnoses.length > 0) {
    const primaryElements = ["HI"]; // Segment ID

    primaryDiagnoses.forEach((diag, index) => {
      const composite = buildDiagnosisComposite(diag, true); // true = primary
      primaryElements.push(composite);

      console.log(`\n✓ Primary Diagnosis #${index + 1}:`);
      console.log(
        `  - Code List Qualifier: ${diag.codeListQualifier || "ABK"}`
      );
      console.log(`  - Code: ${diag.code}`);
      if (diag.date) console.log(`  - Date: ${diag.date}`);
      if (diag.monetaryAmount)
        console.log(`  - Monetary Amount: $${diag.monetaryAmount}`);
      if (diag.quantity) console.log(`  - Quantity: ${diag.quantity}`);
      if (diag.conditionCode)
        console.log(`  - Condition Code: ${diag.conditionCode}`);
      if (diag.occurrenceCode)
        console.log(`  - Occurrence Code: ${diag.occurrenceCode}`);
      console.log(`  - Is Primary: Yes`);
      console.log(`  - Composite: ${composite}`);
    });

    segments.push(primaryElements.join(ELEMENT_DELIMITER));
  }

  // Build HI segment for secondary diagnoses (if exists)
  if (secondaryDiagnoses.length > 0) {
    const secondaryElements = ["HI"]; // Segment ID

    secondaryDiagnoses.forEach((diag, index) => {
      const composite = buildDiagnosisComposite(diag, false); // false = secondary
      secondaryElements.push(composite);

      console.log(`\n  Secondary Diagnosis #${index + 1}:`);
      console.log(
        `  - Code List Qualifier: ${diag.codeListQualifier || "ABK"}`
      );
      console.log(`  - Code: ${diag.code}`);
      if (diag.date) console.log(`  - Date: ${diag.date}`);
      if (diag.monetaryAmount)
        console.log(`  - Monetary Amount: $${diag.monetaryAmount}`);
      if (diag.quantity) console.log(`  - Quantity: ${diag.quantity}`);
      if (diag.conditionCode)
        console.log(`  - Condition Code: ${diag.conditionCode}`);
      if (diag.occurrenceCode)
        console.log(`  - Occurrence Code: ${diag.occurrenceCode}`);
      console.log(`  - Is Primary: No`);
      console.log(`  - Composite: ${composite}`);
    });

    segments.push(secondaryElements.join(ELEMENT_DELIMITER));
  }

  console.log("=========================================================\n");

  return segments;
}

/**
 * Build individual diagnosis composite string
 * @param {Object} diag - Diagnosis object
 * @param {boolean} isPrimary - Whether this is a primary diagnosis
 * @returns {string} Diagnosis composite string
 */
function buildDiagnosisComposite(diag, isPrimary) {
  // Build composite with all available subelements
  const compositeParts = [
    diag.codeListQualifier || "ABK", // 1: ABK=ICD-10, BK=ICD-9, ABF=ICD-10-CM
    diag.code, // 2: Diagnosis code (required)
  ];

  // Track if we need to add optional elements
  const hasOptionalElements =
    diag.date ||
    diag.monetaryAmount ||
    diag.quantity ||
    diag.conditionCode ||
    diag.occurrenceCode ||
    isPrimary;

  if (hasOptionalElements) {
    compositeParts.push(diag.date || ""); // 3: Date (optional)

    if (
      diag.monetaryAmount ||
      diag.quantity ||
      diag.conditionCode ||
      diag.occurrenceCode ||
      isPrimary
    ) {
      compositeParts.push(
        diag.monetaryAmount ? formatAmount(diag.monetaryAmount) : ""
      ); // 4: Monetary amount (optional)

      if (
        diag.quantity ||
        diag.conditionCode ||
        diag.occurrenceCode ||
        isPrimary
      ) {
        compositeParts.push(diag.quantity ? diag.quantity.toString() : ""); // 5: Quantity (optional)

        if (diag.conditionCode || diag.occurrenceCode || isPrimary) {
          compositeParts.push(diag.conditionCode || ""); // 6: Condition Code (optional)

          if (diag.occurrenceCode || isPrimary) {
            compositeParts.push(diag.occurrenceCode || ""); // 7: Occurrence Code (optional)

            // Add primary indicator as 8th element (only for primary diagnoses)
            if (isPrimary) {
              compositeParts.push("Y"); // 8: Primary diagnosis indicator
            }
          }
        }
      }
    }
  }

  // Join with subelement delimiter and trim trailing delimiters (except for primary 'Y')
  let diagnosisComposite = compositeParts.join(SUBELEMENT_DELIMITER);

  // Remove trailing subelement delimiters (but preserve final 'Y' for primary)
  if (!isPrimary) {
    while (diagnosisComposite.endsWith(SUBELEMENT_DELIMITER)) {
      diagnosisComposite = diagnosisComposite.slice(0, -1);
    }
  }

  return diagnosisComposite;
}

/**
 * Build LX segment (Service Line Number)
 * LX*01~
 */
function buildLX(lineNumber) {
  const elements = [
    "LX", // Segment ID
    lineNumber || 1, // 01 - Assigned Number
  ];

  // LX has only 1 required element, no trimming needed
  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build SV1 or SV2 segment based on service line type
 */
function buildServiceLine(serviceLine) {
  if (serviceLine.serviceLineType === "SV2") {
    return buildSV2(serviceLine);
  } else {
    return buildSV1(serviceLine);
  }
}

/**
 * Build SV1 segment (Professional Service Line)
 * SV1*01*02*03*04*05*06*07~
 */
function buildSV1(serviceLine) {
  // Build procedure code composite (HC:CPT:Mod1:Mod2:Mod3:Mod4)
  const procedureElements = [
    serviceLine.procedureCodeQualifier || "HC",
    serviceLine.procedureCode || "",
    serviceLine.procedureModifier1 || "",
    serviceLine.procedureModifier2 || "",
    serviceLine.procedureModifier3 || "",
    serviceLine.procedureModifier4 || "",
  ].filter((el) => el !== "");

  const procedureComposite = procedureElements.join(SUBELEMENT_DELIMITER);

  const elements = [
    "SV1", // Segment ID
    procedureComposite, // 01 - Composite Medical Procedure Identifier
    formatAmount(serviceLine.lineItemCharge || 0), // 02 - Monetary Amount
    serviceLine.unitOrBasisMeasurement || "UN", // 03 - Unit or Basis for Measurement Code
    serviceLine.serviceUnitCount || 1, // 04 - Quantity
    serviceLine.placeOfService || "", // 05 - Facility Code Value
    "", // 06 - Service Type Code (not used)
    serviceLine.diagnosisCodePointer || "", // 07 - Diagnosis Code Pointer
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build SV2 segment (Institutional Service Line)
 * SV2*01*02*03*04*05*06*07~
 */
function buildSV2(serviceLine) {
  // Build procedure code composite (HC:CPT:Mod1:Mod2:Mod3:Mod4)
  const procedureElements = [
    serviceLine.procedureCodeQualifier || "HC",
    serviceLine.procedureCode || "",
    serviceLine.procedureModifier1 || "",
    serviceLine.procedureModifier2 || "",
    serviceLine.procedureModifier3 || "",
    serviceLine.procedureModifier4 || "",
  ].filter((el) => el !== "");

  const procedureComposite = procedureElements.join(SUBELEMENT_DELIMITER);

  const elements = [
    "SV2", // Segment ID
    serviceLine.revenueCode || "", // 01 - Revenue Code
    procedureComposite || "", // 02 - Composite Medical Procedure Identifier
    formatAmount(serviceLine.lineItemCharge || 0), // 03 - Monetary Amount
    serviceLine.unitOrBasisMeasurement || "UN", // 04 - Unit or Basis for Measurement Code
    serviceLine.serviceUnitCount || 1, // 05 - Quantity
    "", // 06 - Non-Covered Charge Amount (not used)
    serviceLine.diagnosisCodePointer || "", // 07 - Diagnosis Code Pointer
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build SBR segment (Subscriber Information)
 * SBR*01*02*03*04*05*06*07*08*09~
 */
function buildSBR(subscriberInfo) {
  const elements = [
    "SBR", // Segment ID
    subscriberInfo?.payerResponsibilitySequence || "P", // 01 - Payer Responsibility Sequence Number
    subscriberInfo?.individualRelationshipCode || "18", // 02 - Individual Relationship Code
    subscriberInfo?.groupNumber || "", // 03 - Reference Identification
    subscriberInfo?.groupName || "", // 04 - Name
    subscriberInfo?.insuranceTypeCode || "", // 05 - Insurance Type Code
    "", // 06 - Coordination of Benefits Code (not used)
    "", // 07 - Yes/No Condition or Response Code (not used)
    "", // 08 - Employment Status Code (not used)
    subscriberInfo?.claimFilingIndicatorCode || "CI", // 09 - Claim Filing Indicator Code
  ];

  return trimTrailingDelimiters(elements.join(ELEMENT_DELIMITER));
}

/**
 * Build SE segment (Transaction Set Trailer)
 * SE*01*02~
 */
function buildSE(transactionSetControlNumber, segmentCount) {
  const elements = [
    "SE", // Segment ID
    segmentCount, // 01 - Number of Included Segments
    (transactionSetControlNumber || "0001").padStart(4, "0"), // 02 - Transaction Set Control Number
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build GE segment (Functional Group Trailer)
 * GE*01*02~
 */
function buildGE(numberOfTransactionSets, groupControlNumber) {
  const elements = [
    "GE", // Segment ID
    numberOfTransactionSets || 1, // 01 - Number of Transaction Sets Included
    groupControlNumber || "1", // 02 - Group Control Number
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Build IEA segment (Interchange Control Trailer)
 * IEA*01*02~
 */
function buildIEA(numberOfFunctionalGroups, interchangeControlNumber) {
  const elements = [
    "IEA", // Segment ID
    numberOfFunctionalGroups || 1, // 01 - Number of Included Functional Groups
    (interchangeControlNumber || "000000001").padStart(9, "0"), // 02 - Interchange Control Number
  ];

  return elements.join(ELEMENT_DELIMITER);
}

/**
 * Helper function to format date to CCYYMMDD format
 * Accepts Date object or ISO string (YYYY-MM-DD)
 */
function formatDateToCCYYMMDD(date) {
  if (!date) return null;

  // If it's already in CCYYMMDD format (8 digits), return as-is
  if (typeof date === "string" && /^\d{8}$/.test(date)) {
    return date;
  }

  // If it's in ISO format (YYYY-MM-DD), convert to CCYYMMDD
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.replace(/-/g, "");
  }

  // If it's a Date object
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  return null;
}

/**
 * Helper function to format time to HHMM format
 */
function formatTimeToHHMM(date) {
  if (!date) return null;

  // If it's already in HHMM format (4 digits), return as-is
  if (typeof date === "string" && /^\d{4}$/.test(date)) {
    return date;
  }

  // If it's a Date object
  if (date instanceof Date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}${minutes}`;
  }

  return null;
}

/**
 * Normalize date to EDI format (CCYYMMDD)
 * Handles various input formats: Date, YYYY-MM-DD, CCYYMMDD
 */
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  return formatDateToCCYYMMDD(dateValue);
}

/**
 * Format amount for EDI - trim unnecessary trailing zeros after decimal
 * Examples: 100.00 -> 100, 100.50 -> 100.5, 100.12 -> 100.12
 * @param {number} amount - The amount to format
 * @returns {string} Formatted amount string
 */
function formatAmount(amount) {
  if (!amount && amount !== 0) return "0";

  // Convert to number and format with 2 decimals
  const formatted = parseFloat(amount).toFixed(2);

  // Remove trailing zeros after decimal point
  // 100.00 -> 100, 100.50 -> 100.5, 100.12 -> 100.12
  return formatted.replace(/\.?0+$/, "");
}

/**
 * Round-trip validation: Parse generated file and compare with original
 * @param {string} generatedContent - The EDI content that was generated
 * @param {Object} originalParsedData - The original parsed data structure
 * @returns {Object} Validation result with isValid and differences
 */
export async function validateRoundTrip(generatedContent, originalParsedData) {
  try {
    // Import the parser dynamically to avoid circular dependency
    const { parseX12Content } = await import("./parsing837.js");

    // Parse the generated content
    const reparsedData = parseX12Content(generatedContent);

    const differences = [];
    const warnings = [];

    // Validate envelope data
    if (
      originalParsedData.isa?.interchangeSenderId !==
      reparsedData.isa?.interchangeSenderId
    ) {
      differences.push({
        field: "ISA Sender ID",
        original: originalParsedData.isa?.interchangeSenderId,
        generated: reparsedData.isa?.interchangeSenderId,
      });
    }

    // Validate claim counts
    const originalClaimCount = originalParsedData.claims?.length || 0;
    const reparsedClaimCount = reparsedData.claims?.length || 0;

    if (originalClaimCount !== reparsedClaimCount) {
      differences.push({
        field: "Claim Count",
        original: originalClaimCount,
        generated: reparsedClaimCount,
      });
    }

    // Validate each claim's critical fields
    for (let i = 0; i < Math.min(originalClaimCount, reparsedClaimCount); i++) {
      const originalClaim = originalParsedData.claims[i];
      const reparsedClaim = reparsedData.claims[i];

      // Check claim numbers
      const origClaimNum = originalClaim.claims?.[0]?.claimNumber;
      const repClaimNum = reparsedClaim.claims?.[0]?.claimNumber;

      if (origClaimNum && repClaimNum && origClaimNum !== repClaimNum) {
        differences.push({
          field: `Claim ${i + 1} Number`,
          original: origClaimNum,
          generated: repClaimNum,
        });
      }

      // Check total charges
      const origTotal = originalClaim.claims?.[0]?.totalCharge;
      const repTotal = reparsedClaim.claims?.[0]?.totalCharge;

      if (origTotal && repTotal && Math.abs(origTotal - repTotal) > 0.01) {
        differences.push({
          field: `Claim ${i + 1} Total Charge`,
          original: origTotal,
          generated: repTotal,
        });
      }

      // Check service line counts
      const origLineCount =
        originalClaim.claims?.[0]?.serviceLines?.length || 0;
      const repLineCount = reparsedClaim.claims?.[0]?.serviceLines?.length || 0;

      if (origLineCount !== repLineCount) {
        differences.push({
          field: `Claim ${i + 1} Service Line Count`,
          original: origLineCount,
          generated: repLineCount,
        });
      }

      // Check diagnosis counts
      const origDiagCount = originalClaim.claims?.[0]?.diagnoses?.length || 0;
      const repDiagCount = reparsedClaim.claims?.[0]?.diagnoses?.length || 0;

      if (origDiagCount !== repDiagCount) {
        warnings.push({
          field: `Claim ${i + 1} Diagnosis Count`,
          original: origDiagCount,
          generated: repDiagCount,
        });
      }
    }

    return {
      isValid: differences.length === 0,
      differenceCount: differences.length,
      warningCount: warnings.length,
      differences,
      warnings,
      summary: {
        originalClaims: originalClaimCount,
        generatedClaims: reparsedClaimCount,
        canBeReparsed: true,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      differenceCount: 0,
      warningCount: 0,
      differences: [],
      warnings: [],
      error: error.message,
      summary: {
        canBeReparsed: false,
        parseError: error.message,
      },
    };
  }
}

/**
 * Generate 837 file from corrected claim in database
 * @param {number} claimId - The claim ID
 * @param {number} fileId - The original file ID
 * @param {string} outputPath - Optional output path
 * @returns {Promise<Object>} Generation result with validation
 */
export async function generate837FromClaim(claimId, fileId, outputPath) {
  try {
    console.log(`\n=== Generating 837 from corrected claim ${claimId} ===`);

    // Fetch corrected data from database
    const generationData = await getGenerationReadyData(claimId, fileId);

    // Generate the 837 file
    const ediContent = await generate837File(generationData, outputPath);

    // Perform round-trip validation
    console.log("Performing round-trip validation...");
    const validation = await validateRoundTrip(ediContent, generationData);

    console.log(
      `✓ Round-trip validation: ${validation.isValid ? "PASSED" : "FAILED"}`
    );
    if (validation.differenceCount > 0) {
      console.log(`  Found ${validation.differenceCount} differences`);
    }
    if (validation.warningCount > 0) {
      console.log(`  Found ${validation.warningCount} warnings`);
    }

    return {
      success: true,
      ediContent,
      outputPath,
      validation,
      claimId,
      fileId,
    };
  } catch (error) {
    console.error("Error generating 837 from claim:", error);
    throw error;
  }
}

export default {
  generate837File,
  getGenerationReadyData,
  generate837FromClaim,
  validateRoundTrip,
};
