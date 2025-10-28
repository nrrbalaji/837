import fs from "fs/promises";
import pool from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import {
  validateFileImport,
  validateClaim,
  validateWithLLM,
} from "./validation.js";
import { generate837File } from "./generate837.js";

/**
 * FHIR to 837 Parsing Service
 * Converts FHIR Claim resources into structured JSON compatible with X12 837 format
 * and stores in database
 */

/**
 * Parse FHIR Claim file and store structured data
 * @param {string} fileId - UUID of the file record
 * @param {string} filePath - Path to the FHIR JSON file
 */
export async function parseFHIRFile(fileId, filePath) {
  const client = await pool.connect();

  try {
    // Get file information for validation
    const fileInfo = await client.query(
      "SELECT file_name, checksum FROM UploadFileDetail WHERE file_id = $1",
      [fileId]
    );

    if (fileInfo.rows.length === 0) {
      throw new Error("File not found in database");
    }

    const fileName = fileInfo.rows[0].file_name;
    const checksum = fileInfo.rows[0].checksum;

    // ========================================================================
    // PHASE 1: FILE IMPORT VALIDATION
    // ========================================================================
    console.log("=== Phase 1: File Import Validation (FHIR) ===");
    const fileValidationResult = await validateFileImport(
      filePath,
      fileName,
      checksum,
      fileId
    );

    if (!fileValidationResult.isValid) {
      console.error("❌ File validation failed:", fileValidationResult.errors);

      // Check if it's a duplicate file
      const isDuplicate = fileValidationResult.errors.some(
        (e) => e.validationName === "Duplicate File"
      );
      const statusUpdate = isDuplicate ? "DUPLICATE" : "VALIDATION_FAILED";

      await client.query(
        `UPDATE UploadFileDetail
         SET upload_status = $1,
             parsing_errors = $2
         WHERE file_id = $3`,
        [
          statusUpdate,
          JSON.stringify({
            phase: "FILE_IMPORT",
            errors: fileValidationResult.errors,
            existingFileId: fileValidationResult.existingFileId || null,
          }),
          fileId,
        ]
      );

      const errorMessage = isDuplicate
        ? `Duplicate file detected (matches file ID: ${fileValidationResult.existingFileId})`
        : `File validation failed: ${fileValidationResult.errors
            .map((e) => e.errorMessage)
            .join(", ")}`;

      throw new Error(errorMessage);
    }

    console.log("✅ File import validation passed");

    // Read file content
    const fileContent = await fs.readFile(filePath, "utf8");
    const fhirData = JSON.parse(fileContent);

    // ========================================================================
    // PHASE 2: PARSE FHIR CONTENT
    // ========================================================================
    console.log("=== Phase 2: Parsing FHIR Content ===");
    const parsedData = parseFHIRContent(fhirData);

    // Extract claims from parsed data
    const claims = extractClaimsFromFHIR(parsedData);
    console.log(`✅ Parsed ${claims.length} claims from FHIR file`);

    // Calculate summary statistics
    const totalAmount = claims.reduce(
      (sum, c) => sum + (parseFloat(c.totalCharge) || 0),
      0
    );
    const claimTypes = [...new Set(claims.map((c) => c.claimType))];
    const claimsByPayer = {};
    claims.forEach((c) => {
      const payer = c.payer || "Unknown";
      claimsByPayer[payer] = (claimsByPayer[payer] || 0) + 1;
    });

    await client.query("BEGIN");

    // Create batch record
    let batchId = null;
    if (parsedData.bundle) {
      const batchResult = await client.query(
        `
        INSERT INTO BatchDetail (
          file_id,
          batch_number,
          control_number,
          claim_count,
          total_amount,
          batch_status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING batch_id
      `,
        [
          fileId,
          "FHIR-BATCH-" + Date.now(),
          parsedData.bundle?.id || null,
          claims.length,
          totalAmount,
          "PENDING",
        ]
      );
      batchId = batchResult.rows[0].batch_id;
    }

    const parseDescription = `Initial parse: ${claims.length} claim(s) extracted from FHIR file`;
    const parsingSummary = {
      totalClaims: claims.length,
      totalAmount: totalAmount.toFixed(2),
      claimTypes: claimTypes,
      claimsByPayer: claimsByPayer,
      batchNumber: parsedData.bundle?.id || null,
      sender: parsedData.bundle?.meta?.source || null,
      transactionDate: parsedData.bundle?.timestamp || new Date().toISOString(),
      parsedAt: new Date().toISOString(),
      inputFormat: "FHIR",
      statistics: {
        averageClaimAmount:
          claims.length > 0 ? (totalAmount / claims.length).toFixed(2) : 0,
        maxClaimAmount:
          claims.length > 0
            ? Math.max(...claims.map((c) => c.totalCharge || 0)).toFixed(2)
            : 0,
        minClaimAmount:
          claims.length > 0
            ? Math.min(...claims.map((c) => c.totalCharge || 0)).toFixed(2)
            : 0,
      },
    };

    // Update file status and store parsed JSON with comprehensive summary
    await client.query(
      `
      UPDATE UploadFileDetail
      SET
        upload_status = $1,
        parsed_json = $2,
        parsing_summary = $3,
        parsed_at = CURRENT_TIMESTAMP
      WHERE file_id = $4
    `,
      [
        "PARSED",
        JSON.stringify(parsedData),
        JSON.stringify(parsingSummary),
        fileId,
      ]
    );

    // Log the initial parse to history log table
    await client.query(
      `SELECT log_parsed_json_change(
        $1::UUID,
        NULL,
        $2::JSONB,
        $3::VARCHAR,
        $4::TEXT,
        NULL,
        $5::VARCHAR,
        $6::VARCHAR,
        $7::JSONB
      )`,
      [
        fileId,
        parsedData,
        "INITIAL_PARSE",
        parseDescription,
        "system",
        "PARSING_SERVICE",
        parsingSummary,
      ]
    );

    // ========================================================================
    // PHASE 3: STORE CLAIMS
    // ========================================================================
    console.log("=== Phase 3: Storing Claims ===");
    const storedClaimIds = [];

    // Store individual claims
    for (const claim of claims) {
      const claimId = await storeClaim(client, fileId, batchId, claim);
      storedClaimIds.push({
        claimId,
        claimNumber: claim.claimNumber,
      });
    }

    console.log(`✅ Stored ${storedClaimIds.length} claims in database`);

    // Update batch status to completed
    if (batchId) {
      await client.query(
        `
        UPDATE BatchDetail
        SET batch_status = $1, completed_at = CURRENT_TIMESTAMP
        WHERE batch_id = $2
      `,
        ["COMPLETED", batchId]
      );
    }

    await client.query("COMMIT");

    // ========================================================================
    // PHASE 4: LLM VALIDATION
    // ========================================================================
    console.log("=== Phase 4: LLM Validation ===");
    const llmValidationResult = await validateWithLLM(
      fileName,
      fileId,
      parsedData,
      claims
    );

    // ========================================================================
    // PHASE 5: BUSINESS RULE VALIDATION
    // ========================================================================
    console.log("=== Phase 5: Business Rule Validation ===");
    const claimValidationResults = [];

    // Run business rule validation for each stored claim
    for (const storedClaim of storedClaimIds) {
      try {
        console.log(`Validating claim ${storedClaim.claimId}...`);
        const validationResult = await validateClaim(storedClaim.claimId);
        claimValidationResults.push({
          claimId: storedClaim.claimId,
          claimNumber: storedClaim.claimNumber,
          status: validationResult.status,
          errorCount: validationResult.errorCount,
          warningCount: validationResult.warningCount,
        });

        console.log(
          `  ✓ Claim ${storedClaim.claimNumber}: ${validationResult.status} (${validationResult.errorCount} errors, ${validationResult.warningCount} warnings)`
        );
      } catch (validationError) {
        console.error(
          `  ✗ Claim validation error for ${storedClaim.claimId}:`,
          validationError.message
        );
        claimValidationResults.push({
          claimId: storedClaim.claimId,
          claimNumber: storedClaim.claimNumber,
          status: "VALIDATION_ERROR",
          error: validationError.message,
        });
      }
    }

    // Summary statistics
    const validationSummary = {
      totalClaims: claimValidationResults.length,
      passed: claimValidationResults.filter((r) => r.status === "PASSED")
        .length,
      failed: claimValidationResults.filter((r) => r.status === "FAILED")
        .length,
      errors: claimValidationResults.filter(
        (r) => r.status === "VALIDATION_ERROR"
      ).length,
    };

    // Generate 837 file from parsed data
    const exportDir = process.env.OUTPUT_DIR + "/" + fileId + ".txt";
    await generate837File(parsedData, exportDir);

    console.log("\n=== Parsing & Validation Complete ===");
    console.log(
      `✅ Successfully parsed FHIR file ${fileId} with ${
        claims.length
      } claims (Batch: ${batchId || "N/A"})`
    );
    console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
    console.log(`   Claim Types: ${claimTypes.join(", ")}`);
    console.log(`\n📊 Business Rule Validation:`);
    console.log(`   ✓ Passed: ${validationSummary.passed}`);
    console.log(`   ✗ Failed: ${validationSummary.failed}`);
    console.log(`   ⚠ Errors: ${validationSummary.errors}`);
    console.log("=====================================\n");
  } catch (error) {
    await client.query("ROLLBACK");

    // Update file status to failed
    await client.query(
      `
      UPDATE UploadFileDetail
      SET
        upload_status = $1,
        parsing_errors = $2
      WHERE file_id = $3
    `,
      [
        "FAILED",
        JSON.stringify({ error: error.message, stack: error.stack }),
        fileId,
      ]
    );
    console.error("FHIR Parsing error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse FHIR content into structured format compatible with X12 837
 * @param {Object} fhirData - FHIR Bundle or Claim resource
 */
function parseFHIRContent(fhirData) {
  const parsedData = {
    isa: null,
    gs: null,
    st: null,
    claims: [],
    metadata: {
      inputFormat: "FHIR",
      parsedAt: new Date().toISOString(),
    },
    bundle: null,
  };

  // Handle FHIR Bundle
  if (fhirData.resourceType === "Bundle") {
    parsedData.bundle = {
      id: fhirData.id,
      type: fhirData.type,
      timestamp: fhirData.timestamp,
      total: fhirData.total,
      meta: fhirData.meta,
    };

    // Process each entry in the bundle
    if (fhirData.entry && Array.isArray(fhirData.entry)) {
      fhirData.entry.forEach((entry) => {
        if (entry.resource?.resourceType === "Claim") {
          const claimData = parseFHIRClaim(entry.resource);
          if (claimData) {
            parsedData.claims.push(claimData);
          }
        }
      });
    }
  } else if (fhirData.resourceType === "Claim") {
    // Handle single Claim resource
    const claimData = parseFHIRClaim(fhirData);
    if (claimData) {
      parsedData.claims.push(claimData);
    }
  } else {
    throw new Error(
      `Unsupported FHIR resource type: ${fhirData.resourceType}. Expected Bundle or Claim.`
    );
  }

  // Generate ISA/GS/ST headers for compatibility with 837 generation
  parsedData.isa = generateISAHeader(fhirData);
  parsedData.gs = generateGSHeader(fhirData);
  parsedData.st = generateSTHeader();

  return parsedData;
}

/**
 * Parse a FHIR Claim resource into X12 837-compatible structure
 */
function parseFHIRClaim(fhirClaim) {
  const claimData = {
    bht: {
      hierarchicalStructureCode: "0019", // FHIR-derived
      transactionSetPurposeCode: "00", // Original
      referenceIdentification: fhirClaim.id || uuidv4(),
      date: formatDateToX12(fhirClaim.created || new Date().toISOString()),
      time: formatTimeToX12(fhirClaim.created || new Date().toISOString()),
      transactionTypeCode: fhirClaim.type?.coding?.[0]?.code || "CH",
    },
    submitter: extractSubmitter(fhirClaim),
    receiver: extractReceiver(fhirClaim),
    billing: extractBillingProvider(fhirClaim),
    subscriber: extractSubscriber(fhirClaim),
    patient: extractPatient(fhirClaim),
    payer: extractPayer(fhirClaim),
    renderingProvider: extractRenderingProvider(fhirClaim),
    serviceFacility: extractServiceFacility(fhirClaim),
    claims: [
      {
        claimNumber: fhirClaim.identifier?.[0]?.value || `CLM-${Date.now()}`,
        totalCharge: calculateTotalCharge(fhirClaim),
        placeOfService: extractPlaceOfService(fhirClaim),
        serviceLines: extractServiceLines(fhirClaim),
        diagnoses: extractDiagnoses(fhirClaim),
      },
    ],
    dates: extractDates(fhirClaim),
    serviceDateFrom: extractServiceDateFrom(fhirClaim),
    serviceDateTo: extractServiceDateTo(fhirClaim),
    subscriberInfo: extractSubscriberInfo(fhirClaim),
    hierarchicalLevels: [],
    references: [],
  };

  return claimData;
}

/**
 * Extract submitter from FHIR Claim
 */
function extractSubmitter(claim) {
  // In FHIR, the submitter could be in the provider field
  const provider = claim.provider?.reference;
  return {
    entityIdentifierCode: "41",
    entityTypeQualifier: "2",
    lastName: claim.provider?.display || "SUBMITTER",
    identificationCode: extractIdentifier(claim.provider),
  };
}

/**
 * Extract receiver (payer) from FHIR Claim
 */
function extractReceiver(claim) {
  const insurer = claim.insurer || claim.insurance?.[0]?.coverage?.payor?.[0];
  return {
    entityIdentifierCode: "40",
    entityTypeQualifier: "2",
    lastName: insurer?.display || "RECEIVER",
    identificationCode: extractIdentifier(insurer),
  };
}

/**
 * Extract billing provider from FHIR Claim
 */
function extractBillingProvider(claim) {
  const provider = claim.provider;
  return {
    entityIdentifierCode: "85",
    entityTypeQualifier: "2",
    lastName: provider?.display || "Unknown",
    identificationCode: extractIdentifier(provider),
  };
}

/**
 * Extract subscriber from FHIR Claim
 */
function extractSubscriber(claim) {
  const subscriber = claim.insurance?.[0]?.coverage?.subscriber;
  const patient = claim.patient;

  // If subscriber reference exists, extract from it; otherwise use patient
  const subscriberRef = subscriber || patient;

  return {
    entityIdentifierCode: "IL",
    entityTypeQualifier: "1",
    lastName: subscriberRef?.display?.split(" ")?.[1] || "Unknown",
    firstName: subscriberRef?.display?.split(" ")?.[0] || "Unknown",
    identificationCode: extractIdentifier(subscriberRef),
  };
}

/**
 * Extract patient from FHIR Claim
 */
function extractPatient(claim) {
  const patient = claim.patient;
  const patientName = patient?.display?.split(" ") || [];

  return {
    entityIdentifierCode: "QC",
    entityTypeQualifier: "1",
    firstName: patientName[0] || "Unknown",
    lastName: patientName[1] || "Unknown",
    middleName: patientName[2] || null,
    identificationCode: extractIdentifier(patient),
  };
}

/**
 * Extract payer from FHIR Claim
 */
function extractPayer(claim) {
  const insurer = claim.insurer || claim.insurance?.[0]?.coverage?.payor?.[0];
  return insurer?.display || "Unknown Payer";
}

/**
 * Extract rendering provider from FHIR Claim
 */
function extractRenderingProvider(claim) {
  const careTeam = claim.careTeam?.find(
    (ct) => ct.role?.coding?.[0]?.code === "primary"
  );
  if (!careTeam) return null;

  return {
    entityIdentifierCode: "82",
    entityTypeQualifier: "1",
    lastName: careTeam.provider?.display?.split(" ")?.[1] || "Unknown",
    firstName: careTeam.provider?.display?.split(" ")?.[0] || "Unknown",
    identificationCode: extractIdentifier(careTeam.provider),
  };
}

/**
 * Extract service facility from FHIR Claim
 */
function extractServiceFacility(claim) {
  const facility = claim.facility;
  if (!facility) return null;

  return {
    entityIdentifierCode: "77",
    entityTypeQualifier: "2",
    lastName: facility.display || "Unknown Facility",
    identificationCode: extractIdentifier(facility),
  };
}

/**
 * Extract service lines from FHIR Claim
 */
function extractServiceLines(claim) {
  if (!claim.item || !Array.isArray(claim.item)) return [];

  return claim.item.map((item, index) => {
    const procedureCode = item.productOrService?.coding?.[0];

    return {
      serviceLineType: "SV1", // Default to professional
      procedureCodeQualifier: procedureCode?.system?.includes("cpt") ? "HC" : "ER",
      procedureCode: procedureCode?.code || "99999",
      procedureModifier1: item.modifier?.[0]?.coding?.[0]?.code || null,
      procedureModifier2: item.modifier?.[1]?.coding?.[0]?.code || null,
      procedureModifier3: item.modifier?.[2]?.coding?.[0]?.code || null,
      procedureModifier4: item.modifier?.[3]?.coding?.[0]?.code || null,
      lineItemCharge: item.net?.value || 0,
      unitOrBasisMeasurement: "UN",
      serviceUnitCount: item.quantity?.value || 1,
      placeOfService: extractPlaceOfService(claim),
      diagnosisCodePointer: extractDiagnosisPointers(item),
      serviceDateFrom: formatDateToYYYYMMDD(item.servicedPeriod?.start || item.servicedDate),
      serviceDateTo: formatDateToYYYYMMDD(item.servicedPeriod?.end || item.servicedDate),
    };
  });
}

/**
 * Extract diagnoses from FHIR Claim
 */
function extractDiagnoses(claim) {
  if (!claim.diagnosis || !Array.isArray(claim.diagnosis)) return [];

  return claim.diagnosis.map((diag, index) => {
    const diagnosisCode = diag.diagnosisCodeableConcept?.coding?.[0];
    return {
      codeListQualifier: diagnosisCode?.system?.includes("icd-10") ? "ABK" : "BK",
      code: diagnosisCode?.code || "UNKNOWN",
      sequence: index + 1,
    };
  });
}

/**
 * Extract dates from FHIR Claim
 */
function extractDates(claim) {
  const dates = [];

  if (claim.billablePeriod?.start) {
    dates.push({
      qualifier: "434",
      format: "RD8",
      value: `${formatDateToX12(claim.billablePeriod.start)}-${formatDateToX12(
        claim.billablePeriod.end || claim.billablePeriod.start
      )}`,
      fromDate: formatDateToYYYYMMDD(claim.billablePeriod.start),
      toDate: formatDateToYYYYMMDD(claim.billablePeriod.end || claim.billablePeriod.start),
    });
  }

  return dates;
}

/**
 * Extract subscriber info from FHIR Claim
 */
function extractSubscriberInfo(claim) {
  const insurance = claim.insurance?.[0];
  return {
    payerResponsibilitySequence: insurance?.sequence === 1 ? "P" : "S",
    individualRelationshipCode: extractRelationshipCode(claim),
    groupNumber: insurance?.coverage?.display || null,
    claimFilingIndicatorCode: "CI",
    relationshipDescription: extractRelationshipDescription(claim),
  };
}

// Helper functions

function extractIdentifier(reference) {
  if (!reference) return null;
  if (reference.identifier?.value) return reference.identifier.value;
  if (reference.reference) {
    const parts = reference.reference.split("/");
    return parts[parts.length - 1];
  }
  return null;
}

function extractPlaceOfService(claim) {
  const facility = claim.facility?.type?.coding?.[0];
  return facility?.code || "11"; // Default to office
}

function extractDiagnosisPointers(item) {
  if (!item.diagnosisSequence) return null;
  return item.diagnosisSequence.map((s) => s.toString()).join("");
}

function extractServiceDateFrom(claim) {
  return formatDateToYYYYMMDD(claim.billablePeriod?.start);
}

function extractServiceDateTo(claim) {
  return formatDateToYYYYMMDD(claim.billablePeriod?.end || claim.billablePeriod?.start);
}

function extractRelationshipCode(claim) {
  // In FHIR, relationship is typically in the insurance focal flag
  const insurance = claim.insurance?.[0];
  return insurance?.focal ? "18" : "19"; // 18=Self, 19=Child (simplified)
}

function extractRelationshipDescription(claim) {
  const code = extractRelationshipCode(claim);
  const map = { "18": "Self", "19": "Child" };
  return map[code] || "Unknown";
}

function calculateTotalCharge(claim) {
  if (claim.total?.value) return claim.total.value;

  // Sum up all item charges
  if (claim.item && Array.isArray(claim.item)) {
    return claim.item.reduce((sum, item) => sum + (item.net?.value || 0), 0);
  }

  return 0;
}

function formatDateToX12(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatTimeToX12(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}${minutes}`;
}

function formatDateToYYYYMMDD(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateISAHeader(fhirData) {
  return {
    authorizationQualifier: "00",
    authorizationInformation: "          ",
    securityQualifier: "00",
    securityInformation: "          ",
    interchangeIdQualifier: "ZZ",
    interchangeSenderId: "FHIR_SENDER",
    interchangeIdQualifier2: "ZZ",
    interchangeReceiverId: "FHIR_RECEIVER",
    interchangeDate: formatDateToX12(new Date().toISOString()),
    interchangeTime: formatTimeToX12(new Date().toISOString()),
    interchangeControlStandards: "U",
    interchangeControlVersion: "00401",
    interchangeControlNumber: String(Date.now()).slice(-9),
    acknowledgmentRequested: "0",
    usageIndicator: "T",
    componentElementSeparator: ":",
  };
}

function generateGSHeader(fhirData) {
  return {
    functionalIdentifierCode: "HC",
    applicationSenderCode: "FHIR_SENDER",
    applicationReceiverCode: "FHIR_RECEIVER",
    date: formatDateToX12(new Date().toISOString()),
    time: formatTimeToX12(new Date().toISOString()),
    groupControlNumber: String(Date.now()).slice(-9),
    responsibleAgencyCode: "X",
    versionReleaseIndustryCode: "005010X222A1",
  };
}

function generateSTHeader() {
  return {
    transactionSetIdentifierCode: "837",
    transactionSetControlNumber: String(Date.now()).slice(-9),
    implementationConventionReference: "005010X222A1",
  };
}

/**
 * Extract claims from parsed FHIR data for database storage
 */
function extractClaimsFromFHIR(parsedData) {
  const claims = [];

  for (const claimData of parsedData.claims) {
    for (const claim of claimData.claims) {
      const payerName =
        claimData.receiver?.lastName ||
        claimData.payer ||
        "Unknown Payer";

      claims.push({
        claimNumber: claim.claimNumber,
        totalCharge: claim.totalCharge || 0,
        placeOfService: claim.placeOfService,
        claimFrequencyCode: "1", // Original claim
        claimType: "Professional", // Default
        submitter: claimData.submitter,
        receiver: claimData.receiver,
        billing: claimData.billing,
        subscriber: claimData.subscriber,
        patient: claimData.patient,
        payer: claimData.payer || payerName,
        renderingProvider: claimData.renderingProvider,
        serviceFacility: claimData.serviceFacility,
        serviceLines: claim.serviceLines || [],
        diagnoses: claim.diagnoses || [],
        dates: claimData.dates || [],
        serviceDateFrom: claimData.serviceDateFrom,
        serviceDateTo: claimData.serviceDateTo,
        subscriberInfo: claimData.subscriberInfo,
        hierarchicalLevels: claimData.hierarchicalLevels || [],
        references: claimData.references || [],
        rawData: claim,
      });
    }
  }

  return claims;
}

/**
 * Store claim in database (reuses logic from parsing837.js)
 */
async function storeClaim(client, fileId, batchId, claim) {
  // Lookup master table IDs
  const facilityId = await lookupFacility(client, claim.billing);
  const providerId = await lookupProvider(client, claim.billing);
  const payerId = await lookupPayer(client, claim.receiver, claim.payer);
  const patientId = await lookupOrCreatePatient(client, claim.patient, facilityId);

  // Insert claim header
  const claimResult = await client.query(
    `
    INSERT INTO ClaimHeader (
      file_id,
      batch_id,
      claim_number,
      claim_type,
      patient_id,
      facility_id,
      provider_id,
      payer_id,
      total_charge,
      place_of_service,
      claim_frequency_code,
      service_date_from,
      service_date_to,
      claim_status,
      validation_status,
      raw_claim_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING claim_id
  `,
    [
      fileId,
      batchId,
      truncate(claim.claimNumber, 50),
      truncate(claim.claimType, 20),
      patientId,
      facilityId,
      providerId,
      payerId,
      claim.totalCharge || 0,
      truncate(claim.placeOfService, 2),
      truncate(claim.claimFrequencyCode, 1),
      claim.serviceDateFrom || null,
      claim.serviceDateTo || null,
      "PENDING",
      "NOT_VALIDATED",
      JSON.stringify(claim.rawData),
    ]
  );

  const claimId = claimResult.rows[0].claim_id;

  // Insert service lines
  for (let i = 0; i < claim.serviceLines.length; i++) {
    const line = claim.serviceLines[i];

    await client.query(
      `
      INSERT INTO ClaimLine (
        claim_id,
        line_number,
        service_date_from,
        service_date_to,
        revenue_code,
        procedure_code,
        procedure_modifier1,
        procedure_modifier2,
        procedure_modifier3,
        procedure_modifier4,
        quantity,
        unit_charge,
        total_charge,
        place_of_service,
        diagnosis_pointer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
      [
        claimId,
        i + 1,
        line.serviceDateFrom || null,
        line.serviceDateTo || null,
        truncate(line.revenueCode, 4),
        truncate(line.procedureCode, 10),
        truncate(line.procedureModifier1, 2),
        truncate(line.procedureModifier2, 2),
        truncate(line.procedureModifier3, 2),
        truncate(line.procedureModifier4, 2),
        line.serviceUnitCount || 1,
        line.lineItemCharge / (line.serviceUnitCount || 1) || 0,
        line.lineItemCharge || 0,
        truncate(line.placeOfService, 2),
        truncate(line.diagnosisCodePointer, 10),
      ]
    );
  }

  // Insert diagnoses
  for (let i = 0; i < claim.diagnoses.length; i++) {
    const diag = claim.diagnoses[i];
    await client.query(
      `
      INSERT INTO ClaimDiagnosis (
        claim_id,
        diagnosis_sequence,
        diagnosis_code,
        diagnosis_type,
        is_principal
      ) VALUES ($1, $2, $3, $4, $5)
    `,
      [
        claimId,
        i + 1,
        truncate(diag.code, 10),
        truncate(diag.codeListQualifier, 3),
        i === 0,
      ]
    );
  }

  return claimId;
}

// Helper functions (reused from parsing837.js)

function truncate(str, maxLength) {
  if (!str) return null;
  return str.toString().substring(0, maxLength);
}

async function lookupOrCreatePatient(client, patientData, facilityId) {
  if (!patientData || !patientData.lastName) return null;

  const firstName = patientData.firstName || "Unknown";
  const lastName = patientData.lastName;

  const existingPatient = await client.query(
    `
    SELECT patient_id FROM Patient
    WHERE LOWER(last_name) = LOWER($1)
    AND LOWER(first_name) = LOWER($2)
    AND (facility_id = $3 OR facility_id IS NULL)
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [lastName, firstName, facilityId]
  );

  if (existingPatient.rows.length > 0) {
    return existingPatient.rows[0].patient_id;
  }

  const patientControlNumber = uuidv4();
  const mrn = `MRN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newPatient = await client.query(
    `
    INSERT INTO Patient (
      PatientControlNumber, facility_id, first_name, last_name,
      mrn, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING patient_id
  `,
    [patientControlNumber, facilityId, firstName, lastName, mrn, true]
  );

  return newPatient.rows[0].patient_id;
}

async function lookupFacility(client, billingData) {
  if (!billingData) return null;

  if (billingData.identificationCode) {
    const result = await client.query(
      `SELECT facility_id FROM Facilities WHERE npi = $1 AND is_active = true LIMIT 1`,
      [billingData.identificationCode]
    );
    if (result.rows.length > 0) return result.rows[0].facility_id;
  }

  return null;
}

async function lookupProvider(client, billingData) {
  if (!billingData || !billingData.identificationCode) return null;

  const result = await client.query(
    `SELECT provider_id FROM Provider WHERE npi = $1 AND is_active = true LIMIT 1`,
    [billingData.identificationCode]
  );

  return result.rows.length > 0 ? result.rows[0].provider_id : null;
}

async function lookupPayer(client, receiverData, payerName) {
  if (!receiverData && !payerName) return null;

  if (receiverData?.identificationCode) {
    const result = await client.query(
      `SELECT payer_id FROM Payer WHERE electronic_payer_id = $1 AND is_active = true LIMIT 1`,
      [receiverData.identificationCode]
    );
    if (result.rows.length > 0) return result.rows[0].payer_id;
  }

  return null;
}

export default {
  parseFHIRFile,
  parseFHIRContent,
  extractClaimsFromFHIR,
};
