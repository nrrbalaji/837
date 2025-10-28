import fs from "fs/promises";
import pool from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import {
  validateFileImport,
  validateX12Structure,
  validateClaim,
  validateWithLLM,
} from "./validation.js";
import { generate837File } from "./generate837.js";
/**
 * X12 837 Parsing Service
 * Converts raw X12 837 files into structured JSON and stores in database
 * Includes comprehensive 3-tier validation: File → EDI Structure → Business Rules
 */

// Segment delimiters (commonly used in X12)
const SEGMENT_DELIMITER = "~";
const ELEMENT_DELIMITER = "*";
// SUBELEMENT_DELIMITER will be dynamically extracted from ISA16

/**
 * Parse X12 837 file and store structured data
 * Performs validation before parsing
 * @param {string} fileId - File ID from upload
 * @param {string} filePath - Full path to uploaded file
 * @param {string} userId - User ID who initiated the parsing
 */
export async function parse837File(fileId, filePath, userId = null) {
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
    console.log("=== Phase 1: File Import Validation ===");
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

    // Insert parsing started history entry
    await client.query(
      `
     INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
     VALUES ($1, $2, $3, $4, $5)
   `,
      [
        fileId,
        `Parsing initiated for file ${fileName}`,
        "PENDING",
        "Parsing",
        userId,
      ]
    );

    // Read file content
    const fileContent = await fs.readFile(filePath, "utf8");

    // ========================================================================
    // PHASE 2: PARSE X12 CONTENT
    // ========================================================================
    console.log("=== Phase 2: Parsing X12 Content ===");
    const parsedData = parseX12Content(fileContent);

    // Extract claims from parsed data
    const claims = extractClaims(parsedData);
    console.log(`✅ Parsed ${claims.length} claims from file`);

    // Insert parsing completion history entry
    await client.query(
      `
      INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        fileId,
        `Parsing completed, extracted ${claims.length} claim(s)`,
        "SUCCESS",
        "Parsing",
        userId,
      ]
    );

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

    // Create batch record if GS segment exists
    let batchId = null;
    if (parsedData.gs) {
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
          parsedData.gs.groupControlNumber || "BATCH-" + Date.now(),
          parsedData.isa?.interchangeControlNumber || null,
          claims.length,
          totalAmount,
          "PENDING",
        ]
      );
      batchId = batchResult.rows[0].batch_id;
    }

    const parseDescription = `Initial parse: ${claims.length} claim(s) extracted from 837 file`;
    const parsingSummary = {
      totalClaims: claims.length,
      totalAmount: totalAmount.toFixed(2),
      claimTypes: claimTypes,
      claimsByPayer: claimsByPayer,
      batchNumber: parsedData.gs?.groupControlNumber || null,
      interchangeControlNumber:
        parsedData.isa?.interchangeControlNumber || null,
      sender: parsedData.isa?.interchangeSenderId || null,
      receiver: parsedData.isa?.interchangeReceiverId || null,
      transactionDate: parsedData.isa?.interchangeDate || null,
      parsedAt: new Date().toISOString(),
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
    // PHASE 4: X12 EDI STRUCTURE VALIDATION
    // ========================================================================
    console.log("=== Phase 4: X12 EDI Structure Validation ===");
    const ediValidationResult = await validateX12Structure(fileContent, fileId);

    if (!ediValidationResult.isValid) {
      console.warn(
        "⚠️ EDI structure validation failed:",
        ediValidationResult.summary
      );
      console.log(
        `   Found ${ediValidationResult.summary.errorCount} EDI validation errors`
      );

      // Log EDI validation errors but don't fail the file
      await client.query(
        `UPDATE UploadFileDetail
         SET parsing_summary = parsing_summary || $1::jsonb
         WHERE file_id = $2`,
        [
          JSON.stringify({
            ediValidation: {
              isValid: false,
              errorCount: ediValidationResult.summary.errorCount,
              errors: ediValidationResult.errors.slice(0, 10), // First 10 errors
            },
          }),
          fileId,
        ]
      );
    } else {
      console.log("✅ EDI structure validation passed");
    }
    console.log(
      `   Total Segments: ${ediValidationResult.summary.totalSegments}`
    );
    console.log(`   Claims Found: ${ediValidationResult.summary.claimCount}`);

    // ========================================================================
    // PHASE 5: BUSINESS RULE VALIDATION
    // ========================================================================
    console.log("=== Phase 5: LLM Validation ===");
    const llmValidationResult = await validateWithLLM(
      fileName,
      fileId,
      parsedData,
      extractClaims(parsedData)
    );

    // ========================================================================
    // PHASE 6: BUSINESS RULE VALIDATION
    // ========================================================================
    console.log("=== Phase 6: Business Rule Validation ===");
    const claimValidationResults = [];

    // Run business rule validation for each stored claim
    for (const storedClaim of storedClaimIds) {
      try {
        console.log(`Validating claim ${storedClaim.claimId}...`);
        const validationResult = await validateClaim(storedClaim.claimId);

        // Insert validation completion history record
        await client.query(
          `
          INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            fileId,
            `Validation completed for claim ${storedClaim.claimNumber}: ${validationResult.status} (${validationResult.errorCount} errors, ${validationResult.warningCount} warnings)`,
            validationResult.status.toUpperCase(),
            "Validation",
            userId || null,
          ]
        );

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

        // Insert validation failure history record
        await client.query(
          `
          INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            fileId,
            `Validation failed for claim ${storedClaim.claimNumber}: ${validationError.message}`,
            "VALIDATION_ERROR",
            "Validation",
            req?.user?.user_id || userId || null,
          ]
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
      ediValidation: {
        isValid: ediValidationResult.isValid,
        errorCount: ediValidationResult.summary.errorCount,
      },
    };

    // Get facility-specific output folder from ingestion configuration
    const facilityId = await lookupFacility(client, claims[0]?.billing);
    let outputPath = null;

    if (facilityId) {
      try {
        // Query facility's ingestion configuration to get output folder
        const facilityConfigResult = await client.query(
          `SELECT ingestion_config FROM Facilities WHERE facility_id = $1 AND is_active = true`,
          [facilityId]
        );

        if (facilityConfigResult.rows.length > 0) {
          const ingestionConfig = facilityConfigResult.rows[0].ingestion_config;

          // Get output folder based on ingestion mode
          let outputFolder = null;
          if (ingestionConfig?.sftp?.output_folder) {
            outputFolder = ingestionConfig.sftp.output_folder;
          } else if (ingestionConfig?.local?.output_folder) {
            outputFolder = ingestionConfig.local.output_folder;
          }

          if (outputFolder) {
            // Ensure the output folder exists
            const path = await import("path");

            try {
              await fs.mkdir(outputFolder, { recursive: true });
              outputPath = path.default.join(outputFolder, `${fileId}.txt`);
              console.log(
                `✓ Using facility-specific output folder: ${outputFolder}`
              );
            } catch (mkdirError) {
              console.warn(
                `⚠ Could not create facility output folder: ${mkdirError.message}`
              );
              // Fall back to default
              outputPath = process.env.OUTPUT_DIR + "/" + fileId + ".txt";
            }
          }
        }
      } catch (configError) {
        console.warn(
          `⚠ Could not retrieve facility configuration: ${configError.message}`
        );
      }
    }

    // Fall back to default OUTPUT_DIR if no facility-specific path found
    if (!outputPath) {
      outputPath = process.env.OUTPUT_DIR + "/" + fileId + ".txt";
      console.log(`✓ Using default output folder: ${process.env.OUTPUT_DIR}`);
    }

    await generate837File(parsedData, outputPath);

    // Insert export completed history entry
    await client.query(
      `
      INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        fileId,
        `837 file generated successfully at ${outputPath}`,
        "SUCCESS",
        "Export",
        userId,
      ]
    );

    console.log("\n=== Parsing & Validation Complete ===");
    console.log(
      `✅ Successfully parsed file ${fileId} with ${
        claims.length
      } claims (Batch: ${batchId || "N/A"})`
    );
    console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
    console.log(`   Claim Types: ${claimTypes.join(", ")}`);
    console.log(`\n📊 EDI Validation:`);
    console.log(
      `   ${ediValidationResult.isValid ? "✓" : "✗"} EDI Structure: ${
        ediValidationResult.isValid ? "PASSED" : "FAILED"
      } (${ediValidationResult.summary.errorCount} errors)`
    );
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
    console.error("Parsing error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse X12 file content into structured format
 */
function parseX12Content(content) {
  // Remove whitespace and split by segment delimiter
  const segments = content
    .trim()
    .split(SEGMENT_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Extract subelement delimiter from ISA segment (ISA16)
  let subelementDelimiter = ":"; // Default fallback
  if (segments.length > 0 && segments[0].startsWith("ISA")) {
    // ISA16 is at position 16, last character before segment terminator
    const isaSegment = segments[0];
    const isaElements = isaSegment.split(ELEMENT_DELIMITER);
    if (isaElements.length >= 17) {
      subelementDelimiter = isaElements[16];
    }
  }

  const parsedData = {
    isa: null,
    gs: null,
    st: null,
    claims: [],
    metadata: {
      totalSegments: segments.length,
      subelementDelimiter: subelementDelimiter,
    },
  };

  let currentClaim = null;
  let currentLoop = null;
  let lastParsedEntity = null; // Track the last NM1 entity for N3/N4 association

  for (const segment of segments) {
    const elements = segment.split(ELEMENT_DELIMITER);
    const segmentId = elements[0];

    switch (segmentId) {
      case "ISA":
        parsedData.isa = parseISA(elements);
        break;

      case "GS":
        parsedData.gs = parseGS(elements);
        break;

      case "ST":
        parsedData.st = parseST(elements);
        break;

      case "BHT":
        // Beginning of Hierarchical Transaction
        currentClaim = {
          bht: parseBHT(elements),
          submitter: {},
          receiver: {},
          billing: {},
          subscriber: {},
          patient: {},
          claims: [],
        };
        break;

      case "HL":
        // Hierarchical Level
        parseHL(elements, currentClaim, currentLoop);
        break;

      case "NM1":
        // Name segment
        lastParsedEntity = parseNM1(elements, currentClaim, currentLoop);
        break;

      case "PER":
        // Contact Information
        parsePER(elements, currentClaim, currentLoop);
        break;

      case "REF":
        // Reference Identification
        parseREF(elements, currentClaim, currentLoop);
        break;

      case "PRV":
        // Provider Information
        parsePRV(elements, currentClaim, currentLoop);
        break;

      case "N3":
        // Address Line
        parseN3(elements, currentClaim, currentLoop, lastParsedEntity);
        break;

      case "N4":
        // City, State, ZIP
        parseN4(elements, currentClaim, currentLoop, lastParsedEntity);
        break;

      case "SBR":
        // Subscriber Information
        parseSBR(elements, currentClaim);
        break;

      case "DMG":
        // Demographics (DOB, Gender)
        parseDMG(elements, currentClaim, currentLoop);
        break;

      case "CLM":
        // Claim Information
        if (currentClaim) {
          const claimInfo = parseCLM(elements, subelementDelimiter);
          currentClaim.claims.push({
            ...claimInfo,
            serviceLines: [],
            diagnoses: [],
          });
        }
        break;

      case "DTP":
        // Date or Time or Period
        parseDTP(elements, currentClaim);
        break;

      case "HI":
        // Health Care Diagnosis Code
        parseHI(elements, currentClaim, subelementDelimiter);
        break;

      case "CL1":
        // Institutional Claim Code
        parseCL1(elements, currentClaim);
        break;

      case "LX":
        // Service Line Number
        parseLX(elements, currentClaim);
        break;

      case "SV1":
      case "SV2":
        // Service Line (Professional or Institutional)
        parseSV(elements, currentClaim, subelementDelimiter);
        break;

      case "SE":
        // Transaction Set Trailer
        if (currentClaim) {
          parsedData.claims.push(currentClaim);
          currentClaim = null;
        }
        break;

      case "GE":
        // Functional Group Trailer
        parsedData.ge = parseGE(elements);
        break;

      case "IEA":
        // Interchange Control Trailer
        parsedData.iea = parseIEA(elements);
        break;
    }
  }

  return parsedData;
}

/**
 * Parse ISA segment (Interchange Control Header)
 */
function parseISA(elements) {
  return {
    authorizationQualifier: elements[1],
    authorizationInformation: elements[2],
    securityQualifier: elements[3],
    securityInformation: elements[4],
    interchangeIdQualifier: elements[5],
    interchangeSenderId: elements[6],
    interchangeIdQualifier2: elements[7],
    interchangeReceiverId: elements[8],
    interchangeDate: elements[9],
    interchangeTime: elements[10],
    interchangeControlStandards: elements[11],
    interchangeControlVersion: elements[12],
    interchangeControlNumber: elements[13],
    acknowledgmentRequested: elements[14],
    usageIndicator: elements[15],
    componentElementSeparator: elements[16],
  };
}

/**
 * Parse GS segment (Functional Group Header)
 */
function parseGS(elements) {
  return {
    functionalIdentifierCode: elements[1],
    applicationSenderCode: elements[2],
    applicationReceiverCode: elements[3],
    date: elements[4],
    time: elements[5],
    groupControlNumber: elements[6],
    responsibleAgencyCode: elements[7],
    versionReleaseIndustryCode: elements[8],
  };
}

/**
 * Parse ST segment (Transaction Set Header)
 */
function parseST(elements) {
  return {
    transactionSetIdentifierCode: elements[1],
    transactionSetControlNumber: elements[2],
    implementationConventionReference: elements[3],
  };
}

/**
 * Parse BHT segment (Beginning of Hierarchical Transaction)
 */
function parseBHT(elements) {
  return {
    hierarchicalStructureCode: elements[1],
    transactionSetPurposeCode: elements[2],
    referenceIdentification: elements[3],
    date: elements[4],
    time: elements[5],
    transactionTypeCode: elements[6],
  };
}

/**
 * Parse PER segment (Contact Information)
 * PER*01*02*03*04*05*06*07*08*09~
 */
function parsePER(elements, currentClaim, currentLoop) {
  if (!currentClaim) return;

  const contacts = [];

  // PER segment can contain multiple contact methods
  // Elements come in pairs: qualifier + number
  const contactData = {
    functionCode: elements[1] || "IC", // IC=Information Contact, BL=Billing Contact
    name: elements[2] || "", // Contact name
    communicationQualifier1: elements[3] || "", // TE=Telephone, FX=Fax, EM=Email
    communicationNumber1: elements[4] || "",
    communicationQualifier2: elements[5] || "",
    communicationNumber2: elements[6] || "",
    communicationQualifier3: elements[7] || "",
    communicationNumber3: elements[8] || "",
    contactInquiryReference: elements[9] || "", // Optional reference
  };

  contacts.push(contactData);

  // Attach contacts to the last entity that was parsed
  // Based on typical EDI order: submitter contacts come after submitter NM1
  if (currentClaim.submitter && !currentClaim.submitter.contacts) {
    currentClaim.submitter.contacts = contacts;
  } else if (currentClaim.billing && !currentClaim.billing.contacts) {
    currentClaim.billing.contacts = contacts;
  } else if (currentClaim.receiver && !currentClaim.receiver.contacts) {
    currentClaim.receiver.contacts = contacts;
  }

  console.log("=== PER Parsed (Contact Information) ===");
  console.log("Function Code:", contactData.functionCode);
  console.log("Contact Name:", contactData.name || "N/A");
  console.log(
    "Contact 1:",
    `${contactData.communicationQualifier1 || "N/A"}: ${
      contactData.communicationNumber1 || "N/A"
    }`
  );
  if (contactData.communicationNumber2) {
    console.log(
      "Contact 2:",
      `${contactData.communicationQualifier2 || "N/A"}: ${
        contactData.communicationNumber2
      }`
    );
  }
  if (contactData.communicationNumber3) {
    console.log(
      "Contact 3:",
      `${contactData.communicationQualifier3 || "N/A"}: ${
        contactData.communicationNumber3
      }`
    );
  }
  console.log("================================\n");
}

/**
 * Parse NM1 segment (Name)
 * Returns reference to the entity object for subsequent N3/N4 association
 */
function parseNM1(elements, currentClaim, currentLoop) {
  const entityIdentifierCode = elements[1];
  const entityTypeQualifier = elements[2];
  const lastName = elements[3];
  const firstName = elements[4];
  const middleName = elements[5];
  const namePrefix = elements[6];
  const nameSuffix = elements[7];
  const identificationCodeQualifier = elements[8];
  const identificationCode = elements[9];

  const nameData = {
    entityIdentifierCode,
    entityTypeQualifier,
    lastName,
    firstName,
    middleName,
    namePrefix,
    nameSuffix,
    identificationCodeQualifier,
    identificationCode,
  };

  // Map to appropriate entity based on entity identifier
  // Return reference to the entity for N3/N4 association
  let entityRef = null;
  switch (entityIdentifierCode) {
    case "41": // Submitter
      currentClaim.submitter = nameData;
      entityRef = currentClaim.submitter;
      break;
    case "40": // Receiver
      currentClaim.receiver = nameData;
      entityRef = currentClaim.receiver;
      break;
    case "85": // Billing Provider
      currentClaim.billing = nameData;
      entityRef = currentClaim.billing;
      break;
    case "IL": // Insured/Subscriber
      currentClaim.subscriber = nameData;
      entityRef = currentClaim.subscriber;
      break;
    case "QC": // Patient
      currentClaim.patient = nameData;
      entityRef = currentClaim.patient;
      break;
    case "PR": // Payer
      currentClaim.payer = nameData;
      entityRef = currentClaim.payer;
      break;
    case "82": // Rendering Provider
      if (!currentClaim.renderingProvider) {
        currentClaim.renderingProvider = nameData;
      }
      entityRef = currentClaim.renderingProvider;
      break;
    case "77": // Service Facility Location
      currentClaim.serviceFacility = nameData;
      entityRef = currentClaim.serviceFacility;
      break;
    case "DN": // Referring Provider
      currentClaim.referringProvider = nameData;
      entityRef = currentClaim.referringProvider;
      break;
  }

  return entityRef;
}

/**
 * Parse HL segment (Hierarchical Level)
 */
function parseHL(elements, currentClaim, currentLoop) {
  if (!currentClaim) return;

  const hierarchicalData = {
    hierarchicalIdNumber: elements[1],
    hierarchicalParentIdNumber: elements[2],
    hierarchicalLevelCode: elements[3], // 20=Billing Provider, 22=Subscriber, 23=Patient
    hierarchicalChildCode: elements[4], // 0=No subordinate, 1=Has subordinate
  };

  if (!currentClaim.hierarchicalLevels) {
    currentClaim.hierarchicalLevels = [];
  }

  currentClaim.hierarchicalLevels.push(hierarchicalData);

  // Track current loop based on hierarchical level
  return hierarchicalData.hierarchicalLevelCode;
}

/**
 * Parse REF segment (Reference Identification)
 */
function parseREF(elements, currentClaim, currentLoop) {
  if (!currentClaim) return;

  const referenceData = {
    referenceQualifier: elements[1], // EI=Tax ID, D9=Prior Auth, etc.
    referenceIdentification: elements[2],
    description: elements[3],
  };

  if (!currentClaim.references) {
    currentClaim.references = [];
  }

  currentClaim.references.push(referenceData);

  // Map specific reference qualifiers to claim fields
  if (referenceData.referenceQualifier === "EI") {
    // Tax ID
    if (currentClaim.billing) {
      currentClaim.billing.taxId = referenceData.referenceIdentification;
    }
  } else if (referenceData.referenceQualifier === "D9") {
    // Prior Authorization Number
    currentClaim.priorAuthNumber = referenceData.referenceIdentification;
  }
}

/**
 * Parse PRV segment (Provider Information)
 * PRV*01*02*03~
 * Used to specify provider specialty/taxonomy information
 */
function parsePRV(elements, currentClaim, currentLoop) {
  if (!currentClaim) return;

  const providerData = {
    providerCode: elements[1], // PE=Performing, RF=Referring, AT=Attending, etc.
    referenceIdentificationQualifier: elements[2], // PXC=Health Care Provider Taxonomy Code, ZZ=Mutually Defined
    providerTaxonomyCode: elements[3], // Taxonomy code (e.g., 207Q00000X)
  };

  // Attach to the last provider that was parsed
  if (
    currentClaim.renderingProvider &&
    !currentClaim.renderingProvider.providerInfo
  ) {
    currentClaim.renderingProvider.providerInfo = providerData;
  } else if (currentClaim.billing && !currentClaim.billing.providerInfo) {
    currentClaim.billing.providerInfo = providerData;
  } else if (
    currentClaim.referringProvider &&
    !currentClaim.referringProvider.providerInfo
  ) {
    currentClaim.referringProvider.providerInfo = providerData;
  }

  console.log("=== PRV Parsed (Provider Information) ===");
  console.log("Provider Code:", providerData.providerCode);
  console.log(
    "Reference Qualifier:",
    providerData.referenceIdentificationQualifier
  );
  console.log("Taxonomy Code:", providerData.providerTaxonomyCode);
  console.log("=========================================\n");
}

/**
 * Parse N3 segment (Address Line)
 * N3 follows NM1 segment and provides address information for that entity
 */
function parseN3(elements, currentClaim, currentLoop, lastParsedEntity) {
  if (!currentClaim || !lastParsedEntity) return;

  const addressData = {
    addressLine1: elements[1],
    addressLine2: elements[2],
  };

  // Store address as nested property in the last parsed NM1 entity
  if (!lastParsedEntity.address) {
    lastParsedEntity.address = {};
  }

  lastParsedEntity.address.addressLine1 = addressData.addressLine1;
  lastParsedEntity.address.addressLine2 = addressData.addressLine2;

  // Also store at top level for backward compatibility
  lastParsedEntity.addressLine1 = addressData.addressLine1;
  lastParsedEntity.addressLine2 = addressData.addressLine2;
}

/**
 * Parse N4 segment (City, State, ZIP)
 * N4 follows N3 segment and provides city/state/zip for that entity's address
 */
function parseN4(elements, currentClaim, currentLoop, lastParsedEntity) {
  if (!currentClaim || !lastParsedEntity) return;

  const locationData = {
    city: elements[1],
    state: elements[2],
    zipCode: elements[3],
    countryCode: elements[4],
  };

  // Store location as nested property in the last parsed NM1 entity's address
  if (!lastParsedEntity.address) {
    lastParsedEntity.address = {};
  }

  lastParsedEntity.address.city = locationData.city;
  lastParsedEntity.address.state = locationData.state;
  lastParsedEntity.address.zipCode = locationData.zipCode;
  lastParsedEntity.address.countryCode = locationData.countryCode;

  // Also store at top level for backward compatibility
  lastParsedEntity.city = locationData.city;
  lastParsedEntity.state = locationData.state;
  lastParsedEntity.zipCode = locationData.zipCode;
  lastParsedEntity.countryCode = locationData.countryCode;
}

/**
 * Parse SBR segment (Subscriber Information)
 */
function parseSBR(elements, currentClaim) {
  if (!currentClaim) return;

  const relationshipCode = elements[2]; // 18=Self, 01=Spouse, 19=Child

  currentClaim.subscriberInfo = {
    payerResponsibilitySequence: elements[1], // P=Primary, S=Secondary, T=Tertiary
    individualRelationshipCode: relationshipCode,
    groupNumber: elements[3],
    groupName: elements[4],
    insuranceTypeCode: elements[5],
    claimFilingIndicatorCode: elements[9], // CI=Commercial Insurance
  };

  // Map relationship code to readable description
  const relationshipMap = {
    "01": "Spouse",
    "04": "Grandfather or Grandmother",
    "05": "Grandson or Granddaughter",
    "07": "Nephew or Niece",
    10: "Foster Child",
    15: "Ward",
    17: "Stepson or Stepdaughter",
    18: "Self",
    19: "Child",
    20: "Employee",
    21: "Unknown",
    22: "Handicapped Dependent",
    23: "Sponsored Dependent",
    24: "Dependent of a Minor Dependent",
    29: "Significant Other",
    32: "Mother",
    33: "Father",
    34: "Other Adult",
    36: "Emancipated Minor",
    39: "Organ Donor",
    40: "Cadaver Donor",
    41: "Injured Plaintiff",
    43: "Child Where Insured Has No Financial Responsibility",
    53: "Life Partner",
    G8: "Other Relationship",
  };

  currentClaim.subscriberInfo.relationshipDescription =
    relationshipMap[relationshipCode] || "Unknown";

  // If relationship is "18" (Self), subscriber IS the patient
  // Copy subscriber data to patient if patient data is not already populated
  if (relationshipCode === "18") {
    console.log("=== SBR: Subscriber is Self (Patient) ===");

    // If patient doesn't have data yet, copy from subscriber
    if (currentClaim.subscriber && currentClaim.subscriber.lastName) {
      if (!currentClaim.patient || !currentClaim.patient.lastName) {
        currentClaim.patient = { ...currentClaim.subscriber };
        console.log("Copied subscriber data to patient (Self relationship)");
      }
    }
  } else {
    console.log(
      `=== SBR: Patient is ${currentClaim.subscriberInfo.relationshipDescription} of Subscriber ===`
    );
  }
}

/**
 * Parse DMG segment (Demographics)
 */
function parseDMG(elements, currentClaim, currentLoop) {
  if (!currentClaim) return;

  const demographicsData = {
    dateFormatQualifier: elements[1], // D8=CCYYMMDD
    dateOfBirth: elements[2], // Format: CCYYMMDD
    genderCode: elements[3], // M=Male, F=Female, U=Unknown
  };

  // Convert DOB to YYYY-MM-DD format
  if (
    demographicsData.dateOfBirth &&
    demographicsData.dateOfBirth.length === 8
  ) {
    demographicsData.dateOfBirthFormatted = formatDate(
      demographicsData.dateOfBirth
    );
  }

  // Attach to subscriber or patient based on context
  if (
    currentClaim.subscriber &&
    currentClaim.subscriber.lastName &&
    !currentClaim.subscriber.dateOfBirth
  ) {
    currentClaim.subscriber.dateOfBirth = demographicsData.dateOfBirthFormatted;
    currentClaim.subscriber.gender = demographicsData.genderCode;
  } else if (
    currentClaim.patient &&
    currentClaim.patient.lastName &&
    !currentClaim.patient.dateOfBirth
  ) {
    currentClaim.patient.dateOfBirth = demographicsData.dateOfBirthFormatted;
    currentClaim.patient.gender = demographicsData.genderCode;
  }
}

/**
 * Parse LX segment (Service Line Number)
 */
function parseLX(elements, currentClaim) {
  if (!currentClaim || !currentClaim.claims || currentClaim.claims.length === 0)
    return;

  const currentClaimData = currentClaim.claims[currentClaim.claims.length - 1];

  currentClaimData.currentLineNumber = parseInt(elements[1]) || 1;
}

/**
 * Parse GE segment (Functional Group Trailer)
 */
function parseGE(elements) {
  return {
    numberOfTransactionSets: parseInt(elements[1]) || 0,
    groupControlNumber: elements[2],
  };
}

/**
 * Parse IEA segment (Interchange Control Trailer)
 */
function parseIEA(elements) {
  return {
    numberOfFunctionalGroups: parseInt(elements[1]) || 0,
    interchangeControlNumber: elements[2],
  };
}

/**
 * Parse CLM segment (Claim Information)
 */
function parseCLM(elements, subelementDelimiter) {
  return {
    claimNumber: elements[1],
    totalCharge: parseFloat(elements[2]) || 0,
    placeOfService: elements[5]?.split(subelementDelimiter)[0],
    facilityCodeQualifier: elements[5]?.split(subelementDelimiter)[1],
    claimFrequencyCode: elements[5]?.split(subelementDelimiter)[2],
    providerSignatureIndicator: elements[6],
    assignmentOfBenefitsIndicator: elements[7],
    benefitsAssignmentCertification: elements[8],
    releaseOfInformationCode: elements[9],
  };
}

/**
 * Parse DTP segment (Date/Time/Period)
 */
function parseDTP(elements, currentClaim) {
  const dateQualifier = elements[1];
  const dateFormatQualifier = elements[2];
  const dateValue = elements[3];

  if (!currentClaim.dates) {
    currentClaim.dates = [];
  }

  // Parse date value based on format
  let parsedDate = null;
  let fromDate = null;
  let toDate = null;

  if (dateFormatQualifier === "RD8" && dateValue) {
    // RD8 = Date Range in format CCYYMMDD-CCYYMMDD
    const dateParts = dateValue.split("-");
    if (dateParts.length === 2) {
      fromDate = formatDate(dateParts[0]);
      toDate = formatDate(dateParts[1]);
    }
  } else if (dateFormatQualifier === "D8" && dateValue) {
    // D8 = Single Date in format CCYYMMDD
    parsedDate = formatDate(dateValue);
  }

  currentClaim.dates.push({
    qualifier: dateQualifier,
    format: dateFormatQualifier,
    value: dateValue,
    parsedDate,
    fromDate,
    toDate,
  });

  // Check if we're in a service line context (if there are service lines already)
  const inServiceLineContext =
    currentClaim.claims &&
    currentClaim.claims.length > 0 &&
    currentClaim.claims[currentClaim.claims.length - 1].serviceLines.length > 0;

  if (inServiceLineContext) {
    // Get the last service line
    const currentClaimData =
      currentClaim.claims[currentClaim.claims.length - 1];
    const currentServiceLine =
      currentClaimData.serviceLines[currentClaimData.serviceLines.length - 1];

    // Store dates in service line
    if (dateQualifier === "472") {
      // Service Date for line
      currentServiceLine.serviceDateFrom = fromDate || parsedDate;
      currentServiceLine.serviceDateTo = toDate || parsedDate;
    }

    console.log("=== DTP Parsed (Service Line Context) ===");
    console.log("Date Qualifier:", dateQualifier);
    console.log("Format Qualifier:", dateFormatQualifier);
    console.log("Raw Date Value:", dateValue);
    console.log("Parsed Date:", parsedDate);
    console.log("From Date:", fromDate);
    console.log("To Date:", toDate);
    console.log("Service Line Dates:", {
      serviceDateFrom: currentServiceLine.serviceDateFrom,
      serviceDateTo: currentServiceLine.serviceDateTo,
    });
    console.log("==================\n");
  } else {
    // Map specific date qualifiers to claim header fields
    if (dateQualifier === "472") {
      // Service Date
      currentClaim.serviceDateFrom = fromDate || parsedDate;
      currentClaim.serviceDateTo = toDate || parsedDate;
    } else if (dateQualifier === "434") {
      // Statement Date (from-to)
      currentClaim.statementDateFrom = fromDate || parsedDate;
      currentClaim.statementDateTo = toDate || parsedDate;
    } else if (dateQualifier === "435") {
      // Admission Date
      currentClaim.admissionDate = parsedDate;
    } else if (dateQualifier === "096") {
      // Discharge Date
      currentClaim.dischargeDate = parsedDate;
    }

    console.log("=== DTP Parsed (Claim Header Context) ===");
    console.log("Date Qualifier:", dateQualifier);
    console.log("Format Qualifier:", dateFormatQualifier);
    console.log("Raw Date Value:", dateValue);
    console.log("Parsed Date:", parsedDate);
    console.log("From Date:", fromDate);
    console.log("To Date:", toDate);
    console.log("Current Claim Dates:", {
      serviceDateFrom: currentClaim.serviceDateFrom,
      serviceDateTo: currentClaim.serviceDateTo,
      statementDateFrom: currentClaim.statementDateFrom,
      statementDateTo: currentClaim.statementDateTo,
      admissionDate: currentClaim.admissionDate,
      dischargeDate: currentClaim.dischargeDate,
    });
    console.log("==================\n");
  }
}

/**
 * Format date from CCYYMMDD to YYYY-MM-DD
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

/**
 * Parse HI segment (Health Care Diagnosis Code)
 * HI segment structure: HI*qualifier:code:date:amount:quantity:conditionCode:occurrenceCode:isPrincipal*...*
 * Each element can contain up to 8 subelements providing detailed diagnosis information
 */
function parseHI(elements, currentClaim, subelementDelimiter) {
  if (!currentClaim.claims || currentClaim.claims.length === 0) return;

  const currentClaimData = currentClaim.claims[currentClaim.claims.length - 1];

  console.log("=== HI Parsed (Health Care Diagnosis Code) ===");
  console.log("Total HI Elements:", elements.length - 1);

  // Skip first element (segment ID)
  for (let i = 1; i < elements.length; i++) {
    if (elements[i]) {
      const diagParts = elements[i].split(subelementDelimiter);
      if (diagParts.length >= 2) {
        const diagnosisData = {
          codeListQualifier: diagParts[0], // ABK=ICD-10, BK=ICD-9, ABF=ICD-10-CM
          code: diagParts[1], // Diagnosis code
          date: diagParts[2] || null, // Date (optional)
          monetaryAmount: diagParts[3] ? parseFloat(diagParts[3]) : null, // Monetary amount (optional)
          quantity: diagParts[4] ? parseFloat(diagParts[4]) : null, // Quantity (optional)
          conditionCode: diagParts[5] || null, // Condition Code (optional)
          occurrenceCode: diagParts[6] || null, // Occurrence Code (optional)
          isPrimary: diagParts[8] === "Y", // Primary diagnosis indicator (Y/N) - Position 8
          sequence: i,
        };

        currentClaimData.diagnoses.push(diagnosisData);

        console.log(`\nDiagnosis #${i}:`);
        console.log(
          `  - Code List Qualifier: ${diagnosisData.codeListQualifier}`
        );
        console.log(`  - Code: ${diagnosisData.code}`);
        if (diagnosisData.date) {
          console.log(`  - Date: ${diagnosisData.date}`);
        }
        if (diagnosisData.monetaryAmount) {
          console.log(`  - Monetary Amount: $${diagnosisData.monetaryAmount}`);
        }
        if (diagnosisData.quantity) {
          console.log(`  - Quantity: ${diagnosisData.quantity}`);
        }
        if (diagnosisData.conditionCode) {
          console.log(`  - Condition Code: ${diagnosisData.conditionCode}`);
        }
        if (diagnosisData.occurrenceCode) {
          console.log(`  - Occurrence Code: ${diagnosisData.occurrenceCode}`);
        }
        console.log(
          `  - Is Primary: ${diagnosisData.isPrimary ? "Yes" : "No"}`
        );
        console.log(`  - Sequence: ${diagnosisData.sequence}`);
      }
    }
  }
  console.log("===============================================\n");
}

/**
 * Parse CL1 segment (Institutional Claim Code)
 * CL1*01*02*03*04~
 * Used for institutional claims (837I) to provide admission type, source, and patient status
 */
function parseCL1(elements, currentClaim) {
  if (!currentClaim.claims || currentClaim.claims.length === 0) return;

  const currentClaimData = currentClaim.claims[currentClaim.claims.length - 1];

  const cl1Data = {
    admissionTypeCode: elements[1] || null, // 01 - Admission Type Code
    admissionSourceCode: elements[2] || null, // 02 - Admission Source Code
    patientStatusCode: elements[3] || null, // 03 - Patient Discharge Status Code
    nursingHomeResidentialStatusCode: elements[4] || null, // 04 - Nursing Home Residential Status Code
  };

  // Attach CL1 data to current claim
  currentClaimData.cl1 = cl1Data;

  console.log("=== CL1 Parsed (Institutional Claim Code) ===");
  console.log("Admission Type Code:", cl1Data.admissionTypeCode || "N/A");
  console.log("Admission Source Code:", cl1Data.admissionSourceCode || "N/A");
  console.log("Patient Status Code:", cl1Data.patientStatusCode || "N/A");
  console.log(
    "Nursing Home Status:",
    cl1Data.nursingHomeResidentialStatusCode || "N/A"
  );
  console.log("==============================================\n");
}

/**
 * Parse SV1 segment (Professional Service Line - 837P)
 * Used for CPT/HCPCS-based professional claims
 */
function parseSV1(elements, currentClaim, subelementDelimiter) {
  if (!currentClaim.claims || currentClaim.claims.length === 0) return;

  const currentClaimData = currentClaim.claims[currentClaim.claims.length - 1];

  // SV101: Procedure code composite (HC:CPT:Mod1:Mod2:Mod3:Mod4)
  const procedureInfo = elements[1]?.split(subelementDelimiter) || [];

  const serviceLine = {
    serviceLineType: "SV1", // Professional
    procedureCodeQualifier: procedureInfo[0], // HC = HCPCS/CPT
    procedureCode: procedureInfo[1], // CPT/HCPCS code
    procedureModifier1: procedureInfo[2],
    procedureModifier2: procedureInfo[3],
    procedureModifier3: procedureInfo[4],
    procedureModifier4: procedureInfo[5],
    lineItemCharge: parseFloat(elements[2]) || 0, // SV102
    unitOrBasisMeasurement: elements[3], // SV103 (UN=Units)
    serviceUnitCount: parseFloat(elements[4]) || 0, // SV104
    placeOfService: elements[5], // SV105
    // SV106 is reserved/not used
    diagnosisCodePointer: elements[7], // SV107
  };

  currentClaimData.serviceLines.push(serviceLine);

  // Log parsed professional service line
  console.log("=== SV1 Parsed (Professional) ===");
  console.log("Segment Type: SV1 (837P - Professional Claim)");
  console.log("Raw SV101 Composite:", elements[1]);
  console.log("  - Qualifier:", serviceLine.procedureCodeQualifier || "N/A");
  console.log(
    "  - Procedure Code (CPT/HCPCS):",
    serviceLine.procedureCode || "N/A"
  );
  console.log(
    "  - Modifiers:",
    [
      serviceLine.procedureModifier1,
      serviceLine.procedureModifier2,
      serviceLine.procedureModifier3,
      serviceLine.procedureModifier4,
    ]
      .filter((m) => m)
      .join(", ") || "None"
  );
  console.log("SV102 - Line Charge:", `$${serviceLine.lineItemCharge}`);
  console.log(
    "SV103 - Unit Basis:",
    serviceLine.unitOrBasisMeasurement || "N/A"
  );
  console.log("SV104 - Unit Count:", serviceLine.serviceUnitCount);
  console.log("SV105 - Place of Service:", serviceLine.placeOfService || "N/A");
  console.log(
    "SV107 - Diagnosis Pointer:",
    serviceLine.diagnosisCodePointer || "N/A"
  );
  console.log("Total Service Lines:", currentClaimData.serviceLines.length);
  console.log("==================================\n");
}

/**
 * Parse SV2 segment (Institutional Service Line - 837I)
 * Used for revenue code + CPT/HCPCS institutional claims
 */
function parseSV2(elements, currentClaim, subelementDelimiter) {
  if (!currentClaim.claims || currentClaim.claims.length === 0) return;

  const currentClaimData = currentClaim.claims[currentClaim.claims.length - 1];

  // SV201: Revenue Code (e.g., 0300 for Laboratory)
  const revenueCode = elements[1];

  // SV202: Procedure code composite (optional for institutional)
  const procedureInfo = elements[2]?.split(subelementDelimiter) || [];

  const serviceLine = {
    serviceLineType: "SV2", // Institutional
    revenueCode: revenueCode, // SV201 - Revenue Code (required)
    procedureCodeQualifier: procedureInfo[0], // HC = HCPCS/CPT (optional)
    procedureCode: procedureInfo[1], // CPT/HCPCS code (optional)
    procedureModifier1: procedureInfo[2],
    procedureModifier2: procedureInfo[3],
    procedureModifier3: procedureInfo[4],
    procedureModifier4: procedureInfo[5],
    lineItemCharge: parseFloat(elements[3]) || 0, // SV203
    unitOrBasisMeasurement: elements[4], // SV204 (UN=Units, DA=Days)
    serviceUnitCount: parseFloat(elements[5]) || 0, // SV205
    // SV206 is for non-covered charge amount (optional)
    diagnosisCodePointer: elements[7], // SV207 (optional)
    // Note: SV2 doesn't have place_of_service in the segment - it uses claim-level facility info
    placeOfService: currentClaimData.placeOfService || null, // Fallback to claim-level POS from CLM05
  };

  currentClaimData.serviceLines.push(serviceLine);

  // Log parsed institutional service line
  console.log("=== SV2 Parsed (Institutional) ===");
  console.log("Segment Type: SV2 (837I - Institutional Claim)");
  console.log("SV201 - Revenue Code:", serviceLine.revenueCode || "N/A");
  console.log("Raw SV202 Composite:", elements[2] || "N/A");
  if (serviceLine.procedureCode) {
    console.log("  - Qualifier:", serviceLine.procedureCodeQualifier || "N/A");
    console.log(
      "  - Procedure Code (CPT/HCPCS):",
      serviceLine.procedureCode || "N/A"
    );
    console.log(
      "  - Modifiers:",
      [
        serviceLine.procedureModifier1,
        serviceLine.procedureModifier2,
        serviceLine.procedureModifier3,
        serviceLine.procedureModifier4,
      ]
        .filter((m) => m)
        .join(", ") || "None"
    );
  } else {
    console.log("  - No procedure code (revenue code only)");
  }
  console.log("SV203 - Line Charge:", `$${serviceLine.lineItemCharge}`);
  console.log(
    "SV204 - Unit Basis:",
    serviceLine.unitOrBasisMeasurement || "N/A"
  );
  console.log("SV205 - Unit Count:", serviceLine.serviceUnitCount);
  console.log(
    "SV207 - Diagnosis Pointer:",
    serviceLine.diagnosisCodePointer || "N/A"
  );
  console.log(
    "Place of Service (from CLM05):",
    serviceLine.placeOfService || "N/A"
  );
  console.log("Total Service Lines:", currentClaimData.serviceLines.length);
  console.log("====================================\n");
}

/**
 * Route to appropriate parser based on segment type
 */
function parseSV(elements, currentClaim, subelementDelimiter) {
  const segmentId = elements[0];

  console.log(`=== Routing SV Segment ===`);
  console.log(`Segment ID: ${segmentId}`);
  console.log(`Elements:`, elements);
  console.log(`==========================\n`);

  if (segmentId === "SV1") {
    parseSV1(elements, currentClaim, subelementDelimiter);
  } else if (segmentId === "SV2") {
    parseSV2(elements, currentClaim, subelementDelimiter);
  } else {
    console.warn(`⚠️ Unknown SV segment type: ${segmentId}`);
  }
}

/**
 * Extract claims from parsed data for database storage
 */
function extractClaims(parsedData) {
  const claims = [];

  for (const claimData of parsedData.claims) {
    for (const claim of claimData.claims) {
      // Extract payer information from receiver or NM1 segments
      const payerName =
        claimData.receiver?.lastName ||
        claimData.receiver?.identificationCode ||
        "Unknown Payer";

      claims.push({
        claimNumber:
          claim.claimNumber ||
          `CLM-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        totalCharge: claim.totalCharge || 0,
        placeOfService: claim.placeOfService,
        claimFrequencyCode: claim.claimFrequencyCode,
        claimType:
          parsedData.st?.transactionSetIdentifierCode === "837"
            ? "Professional"
            : "Institutional",
        // Entity information
        submitter: claimData.submitter,
        receiver: claimData.receiver,
        billing: claimData.billing,
        subscriber: claimData.subscriber,
        patient: claimData.patient,
        payer: claimData.payer || payerName,
        renderingProvider: claimData.renderingProvider,
        serviceFacility: claimData.serviceFacility,
        // Claim details
        serviceLines: claim.serviceLines || [],
        diagnoses: claim.diagnoses || [],
        dates: claimData.dates || [],
        // Date fields
        serviceDateFrom: claimData.serviceDateFrom,
        serviceDateTo: claimData.serviceDateTo,
        statementDateFrom: claimData.statementDateFrom,
        statementDateTo: claimData.statementDateTo,
        admissionDate: claimData.admissionDate,
        dischargeDate: claimData.dischargeDate,
        // Additional parsed fields
        subscriberInfo: claimData.subscriberInfo,
        hierarchicalLevels: claimData.hierarchicalLevels || [],
        references: claimData.references || [],
        priorAuthNumber: claimData.priorAuthNumber,
        rawData: claim,
      });
    }
  }

  return claims;
}

/**
 * Safely truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str) return null;
  return str.toString().substring(0, maxLength);
}

/**
 * Lookup or create patient record
 */
async function lookupOrCreatePatient(client, patientData, facilityId) {
  console.log("=== lookupOrCreatePatient ===");
  console.log("Patient Data:", patientData);
  console.log("Facility ID:", facilityId);

  if (!patientData || !patientData.lastName) {
    console.log("No patient data or lastName, returning null");
    return null;
  }

  const firstName = patientData.firstName || "Unknown";
  const lastName = patientData.lastName;
  const middleName = patientData.middleName || null;

  // Try to find existing patient by name and facility
  const existingPatient = await client.query(
    `
    SELECT patient_id, PatientControlNumber FROM Patient
    WHERE LOWER(last_name) = LOWER($1)
    AND LOWER(first_name) = LOWER($2)
    AND (facility_id = $3 OR facility_id IS NULL)
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [lastName, firstName, facilityId]
  );

  if (existingPatient.rows.length > 0) {
    console.log("Found existing patient:", existingPatient.rows[0]);
    return existingPatient.rows[0].patient_id;
  }

  // If no existing patient found, create new one
  console.log("No existing patient found, creating new record...");

  const patientControlNumber = uuidv4();
  const mrn = `MRN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Extract demographics and address from patientData
  const dateOfBirth = patientData.dateOfBirth || null;
  const gender = patientData.gender || null;
  const addressLine1 = patientData.addressLine1 || null;
  const addressLine2 = patientData.addressLine2 || null;
  const city = patientData.city || null;
  const state = patientData.state || null;
  const zipCode = patientData.zipCode || null;
  const phone = patientData.phone || null;
  const email = patientData.email || null;

  const newPatient = await client.query(
    `
    INSERT INTO Patient (
      PatientControlNumber, facility_id, first_name, last_name, middle_name,
      date_of_birth, gender, mrn, address_line1, address_line2, city, state, zip_code,
      phone, email, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING patient_id, PatientControlNumber
  `,
    [
      patientControlNumber,
      facilityId,
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      gender,
      mrn,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      phone,
      email,
      true,
    ]
  );

  console.log("Created new patient:", newPatient.rows[0]);
  console.log("  - DOB:", dateOfBirth);
  console.log("  - Gender:", gender);
  console.log("  - Address:", addressLine1, city, state, zipCode);
  console.log("=============================\n");

  return newPatient.rows[0].patient_id;
}

/**
 * Lookup facility by NPI or name
 */
async function lookupFacility(client, billingData) {
  if (!billingData) return null;

  // Try lookup by NPI first
  if (billingData.identificationCode) {
    const result = await client.query(
      `
      SELECT facility_id FROM Facilities
      WHERE npi = $1 AND is_active = true
      LIMIT 1
    `,
      [billingData.identificationCode]
    );

    if (result.rows.length > 0) {
      return result.rows[0].facility_id;
    }
  }

  // Try lookup by name
  if (billingData.lastName) {
    const result = await client.query(
      `
      SELECT facility_id FROM Facilities
      WHERE facility_name ILIKE $1 AND is_active = true
      LIMIT 1
    `,
      ["%" + billingData.lastName + "%"]
    );

    if (result.rows.length > 0) {
      return result.rows[0].facility_id;
    }
  }

  return null;
}

/**
 * Lookup provider by NPI
 */
async function lookupProvider(client, billingData) {
  if (!billingData || !billingData.identificationCode) return null;

  const result = await client.query(
    `
    SELECT provider_id FROM Provider
    WHERE npi = $1 AND is_active = true
    LIMIT 1
  `,
    [billingData.identificationCode]
  );

  return result.rows.length > 0 ? result.rows[0].provider_id : null;
}

/**
 * Lookup payer by name or electronic payer ID
 */
async function lookupPayer(client, receiverData, payerName) {
  if (!receiverData && !payerName) return null;

  // Try lookup by electronic payer ID
  if (receiverData?.identificationCode) {
    const result = await client.query(
      `
      SELECT payer_id FROM Payer
      WHERE electronic_payer_id = $1 AND is_active = true
      LIMIT 1
    `,
      [receiverData.identificationCode]
    );

    if (result.rows.length > 0) {
      return result.rows[0].payer_id;
    }
  }

  // Try lookup by payer name
  if (payerName || receiverData?.lastName) {
    const searchName = payerName || receiverData.lastName;
    const result = await client.query(
      `
      SELECT payer_id FROM Payer
      WHERE payer_name ILIKE $1 AND is_active = true
      LIMIT 1
    `,
      ["%" + searchName + "%"]
    );

    if (result.rows.length > 0) {
      return result.rows[0].payer_id;
    }
  }

  return null;
}

/**
 * Store claim in database
 */
async function storeClaim(client, fileId, batchId, claim) {
  // Lookup master table IDs
  console.log("=== storeClaim - Looking up IDs ===");
  const facilityId = await lookupFacility(client, claim.billing);
  console.log("Facility ID:", facilityId);

  const providerId = await lookupProvider(client, claim.billing);
  console.log("Provider ID:", providerId);

  const payerId = await lookupPayer(client, claim.receiver, claim.payer);
  console.log("Payer ID:", payerId);

  const patientId = await lookupOrCreatePatient(
    client,
    claim.patient,
    facilityId
  );
  console.log("Patient ID:", patientId);
  console.log("===================================\n");

  // Log claim data before insert for debugging
  console.log("=== Inserting Claim Header ===");
  console.log("Claim Number:", claim.claimNumber);
  console.log("Patient ID:", patientId);
  console.log("Facility ID:", facilityId);
  console.log("Provider ID:", providerId);
  console.log("Payer ID:", payerId);

  // Log subscriber relationship information
  if (claim.subscriberInfo) {
    console.log("\nSubscriber Information:");
    console.log(
      "  - Payer Responsibility:",
      claim.subscriberInfo.payerResponsibilitySequence
    );
    console.log(
      "  - Relationship Code:",
      claim.subscriberInfo.individualRelationshipCode
    );
    console.log(
      "  - Relationship:",
      claim.subscriberInfo.relationshipDescription
    );
    console.log("  - Group Number:", claim.subscriberInfo.groupNumber);
    console.log(
      "  - Filing Indicator:",
      claim.subscriberInfo.claimFilingIndicatorCode
    );
  }

  console.log("\nDates:");
  console.log("  - Service Date From:", claim.serviceDateFrom);
  console.log("  - Service Date To:", claim.serviceDateTo);
  console.log("  - Statement Date From:", claim.statementDateFrom);
  console.log("  - Statement Date To:", claim.statementDateTo);
  console.log("  - Admission Date:", claim.admissionDate);
  console.log("  - Discharge Date:", claim.dischargeDate);
  console.log("==============================\n");

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
      admission_date,
      discharge_date,
      statement_date,
      claim_status,
      validation_status,
      raw_claim_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
      truncate(claim.placeOfService, 2), // VARCHAR(2)
      truncate(claim.claimFrequencyCode, 1), // VARCHAR(1)
      claim.serviceDateFrom || null,
      claim.serviceDateTo || null,
      claim.admissionDate || null,
      claim.dischargeDate || null,
      claim.statementDateFrom || null, // Using statementDateFrom as the statement_date
      "PENDING",
      "NOT_VALIDATED",
      JSON.stringify(claim.rawData),
    ]
  );

  const claimId = claimResult.rows[0].claim_id;

  // Log service lines before insert
  console.log("=== Service Lines ===");
  console.log(`Total Service Lines: ${claim.serviceLines.length}`);
  claim.serviceLines.forEach((line, index) => {
    const lineType = line.serviceLineType || "SV1";
    console.log(`\nService Line #${index + 1} [${lineType}]:`);

    // Show revenue code for institutional claims
    if (lineType === "SV2") {
      console.log(`  - Line Type: Institutional (837I)`);
      console.log(`  - Revenue Code: ${line.revenueCode || "N/A"}`);
    } else {
      console.log(`  - Line Type: Professional (837P)`);
    }

    console.log(`  - Procedure Code: ${line.procedureCode || "N/A"}`);
    console.log(`  - Modifier 1: ${line.procedureModifier1 || "N/A"}`);
    console.log(`  - Modifier 2: ${line.procedureModifier2 || "N/A"}`);
    console.log(`  - Modifier 3: ${line.procedureModifier3 || "N/A"}`);
    console.log(`  - Modifier 4: ${line.procedureModifier4 || "N/A"}`);
    console.log(`  - Charge: $${line.lineItemCharge || 0}`);
    console.log(`  - Units: ${line.serviceUnitCount || 1}`);
    console.log(
      `  - Unit Charge: $${(
        line.lineItemCharge / (line.serviceUnitCount || 1)
      ).toFixed(2)}`
    );
    console.log(`  - Place of Service: ${line.placeOfService || "N/A"}`);
    console.log(`  - Diagnosis Pointer: ${line.diagnosisCodePointer || "N/A"}`);
    console.log(`  - Service Date From: ${line.serviceDateFrom || "N/A"}`);
    console.log(`  - Service Date To: ${line.serviceDateTo || "N/A"}`);
  });
  console.log("=====================\n");

  // Insert service lines
  for (let i = 0; i < claim.serviceLines.length; i++) {
    const line = claim.serviceLines[i];

    const lineType = line.serviceLineType || "SV1";
    const logMessage =
      lineType === "SV2"
        ? `Inserting Service Line #${i + 1} (Institutional) - Revenue: ${
            line.revenueCode
          }, Code: ${line.procedureCode || "N/A"}, Modifiers: ${
            [
              line.procedureModifier1,
              line.procedureModifier2,
              line.procedureModifier3,
              line.procedureModifier4,
            ]
              .filter((m) => m)
              .join(", ") || "None"
          }`
        : `Inserting Service Line #${i + 1} (Professional) - Code: ${
            line.procedureCode
          }, Modifiers: ${
            [
              line.procedureModifier1,
              line.procedureModifier2,
              line.procedureModifier3,
              line.procedureModifier4,
            ]
              .filter((m) => m)
              .join(", ") || "None"
          }`;

    console.log(logMessage);

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
        truncate(line.revenueCode, 4), // For SV2 institutional claims
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
        i === 0, // First diagnosis is principal
      ]
    );
  }

  return claimId;
}

export default {
  parse837File,
  parseX12Content,
  extractClaims,
};
