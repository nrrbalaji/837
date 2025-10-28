import pool from "../config/database.js";
import openai from "../config/openai.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
/**
 * Multi-Tier Validation Service for 837I Claims
 * Implements file-level, structural, and business rule validations
 * Based on 837I X223 TR3 specifications
 */

// ============================================================================
// PHASE 1: FILE IMPORT BASIC VALIDATIONS
// ============================================================================

/**
 * Validate file before parsing
 * Rule 1: File Size Exceeded (> 50MB)
 * Rule 2: Invalid File Extension (.edi, .837, .txt only)
 * Rule 3: Empty File
 * Rule 4: Duplicate File (by checksum - excludes empty files)
 * Rule 5: Missing ISA Segment
 * Rule 6: Missing ISA13
 * Rule 7: Duplicate ISA13 Control Number
 * Rule 8: ISA13 = IEA02 (Control Number Match)
 */
export async function validateFileImport(
  filePath,
  fileName,
  checksum = null,
  fileId = null
) {
  const validationErrors = [];
  const client = await pool.connect();

  try {
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    const fileExtension = path.extname(fileName).toLowerCase();

    // Rule 1: File Size Exceeded (> 50 MB)
    if (fileSize > 50 * 1024 * 1024) {
      validationErrors.push({
        validationName: "File Size Exceeded",
        errorMessage: "File size exceeds 50MB limit.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "File Size Exceeded",
        "ERROR",
        "File size exceeds 50MB limit.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // Rule 2: Invalid File Extension
    const allowedExtensions = [".edi", ".837", ".txt"];
    if (!allowedExtensions.includes(fileExtension)) {
      validationErrors.push({
        validationName: "Invalid File Extension",
        errorMessage: `Invalid file extension. Allowed: ${allowedExtensions.join(
          ", "
        )}.`,
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Invalid File Extension",
        "ERROR",
        `Invalid file extension. Allowed: ${allowedExtensions.join(", ")}.`,
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // Rule 3: Empty File
    // Check BEFORE duplicate check (empty files have same checksum)
    if (fileSize === 0) {
      validationErrors.push({
        validationName: "Empty File",
        errorMessage: "File is empty.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Empty File",
        "ERROR",
        "File is empty.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // Rule 4: Duplicate File Check (by checksum)
    // This happens AFTER empty file check (to avoid false positives)
    if (checksum) {
      const duplicateCheck = await client.query(
        "SELECT file_id, file_name FROM UploadFileDetail WHERE checksum = $1 AND file_id != $2 AND is_deleted = false",
        [checksum, fileId]
      );

      if (duplicateCheck.rows.length > 0) {
        validationErrors.push({
          validationName: "Duplicate File",
          errorMessage: `Duplicate file detected. Same file already uploaded: ${duplicateCheck.rows[0].file_name}`,
          severity: "ERROR",
          logTable: "FileValidationLog",
          existingFileId: duplicateCheck.rows[0].file_id,
        });
        await logFileValidation(
          fileName,
          "Duplicate File",
          "ERROR",
          `Duplicate file detected. File ID: ${duplicateCheck.rows[0].file_id}`,
          fileId
        );
        return {
          isValid: false,
          errors: validationErrors,
          existingFileId: duplicateCheck.rows[0].file_id,
        };
      }
    }

    // Read file content for further validations
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Rule 5: Missing ISA Segment
    if (!fileContent.startsWith("ISA")) {
      validationErrors.push({
        validationName: "Missing ISA Segment",
        errorMessage: "Missing ISA segment in file.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Missing ISA Segment",
        "ERROR",
        "Missing ISA segment in file.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // Extract ISA segment (first 106 characters)
    const isaSegment = fileContent.substring(0, 106);

    // Rule 6: Missing ISA13
    const elementSeparator = fileContent.charAt(3);
    const isaElements = isaSegment.split(elementSeparator);

    if (isaElements.length < 14 || !isaElements[13]) {
      validationErrors.push({
        validationName: "Missing ISA13",
        errorMessage: "ISA13 (Control Number) missing.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Missing ISA13",
        "ERROR",
        "ISA13 (Control Number) missing.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    const isa13 = isaElements[13].trim();

    // Rule 7: Duplicate ISA13
    const duplicateISA13Check = await client.query(
      "SELECT control_number FROM ControlNumberTracker WHERE control_number = $1 AND control_type = $2",
      [isa13, "ISA13"]
    );

    if (duplicateISA13Check.rows.length > 0) {
      validationErrors.push({
        validationName: "Duplicate ISA13",
        errorMessage: "Duplicate file detected. ISA13 already exists.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Duplicate ISA13",
        "ERROR",
        "Duplicate file detected. ISA13 already exists.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // Rule 8: ISA13 = IEA02 validation
    // Find IEA segment (should be at the end of file)
    const ieaMatch = fileContent.match(/IEA\*(\d+)\*(\d+)/);
    if (!ieaMatch) {
      validationErrors.push({
        validationName: "Missing IEA Segment",
        errorMessage: "Missing IEA segment in file.",
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "Missing IEA Segment",
        "ERROR",
        "Missing IEA segment in file.",
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    const iea02 = ieaMatch[2].trim();
    if (isa13 !== iea02) {
      validationErrors.push({
        validationName: "ISA13 IEA02 Mismatch",
        errorMessage: `ISA13 and IEA02 must match. ISA13: ${isa13}, IEA02: ${iea02}`,
        severity: "ERROR",
        logTable: "FileValidationLog",
      });
      await logFileValidation(
        fileName,
        "ISA13 IEA02 Mismatch",
        "ERROR",
        `ISA13 and IEA02 must match. ISA13: ${isa13}, IEA02: ${iea02}`,
        fileId
      );
      return { isValid: false, errors: validationErrors };
    }

    // If all validations pass, track the control number
    await client.query(
      "INSERT INTO ControlNumberTracker (control_number, control_type, file_name) VALUES ($1, $2, $3)",
      [isa13, "ISA13", fileName]
    );

    return {
      isValid: true,
      errors: validationErrors,
      isa13: isa13,
      elementSeparator: elementSeparator,
      segmentTerminator: fileContent.charAt(105),
    };
  } catch (error) {
    console.error("File validation error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Log file validation errors
 * Uses autonomous transaction to ensure logs are persisted even if validation fails
 */
async function logFileValidation(
  fileName,
  validationName,
  severity,
  errorMessage,
  fileId = null,
  llmsummary = ""
) {
  // Use a separate connection for logging to ensure it's committed independently
  const logClient = await pool.connect();
  try {
    await logClient.query(
      `
      INSERT INTO FileValidationLog (
        file_id,
        validation_type,
        validation_rule,
        severity,
        error_message,
        error_location,
        validated_at,
        llmsummary
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(),$7)
    `,
      [
        fileId,
        "FILE_LEVEL",
        validationName,
        severity,
        errorMessage,
        fileName,
        llmsummary,
      ]
    );
    // Immediately commit the log entry
    await logClient.query("COMMIT");
  } catch (error) {
    console.error("Error logging file validation:", error);
    await logClient.query("ROLLBACK");
  } finally {
    logClient.release();
  }
}

// ============================================================================
// PHASE 2: X12 EDI PARSER VALIDATIONS
// ============================================================================

/**
 * Comprehensive X12 837I EDI validation
 * Based on official 837I X223 TR3 guide
 */
export async function validateX12Structure(fileContent, fileId) {
  const validationErrors = [];
  const client = await pool.connect();

  try {
    // Extract delimiters
    const elementSeparator = fileContent.charAt(3);
    const segmentTerminator = fileContent.charAt(105);
    const segments = fileContent
      .split(segmentTerminator)
      .map((s) => s.replace(/[\r\n]/g, "").trim())
      .filter((s) => s.length > 0);

    // ========================================================================
    // ENVELOPE & CONTROL VALIDATIONS
    // ========================================================================

    // Rule 1: ISA must be 106 chars, 16 elements
    const isaSegment = segments[0];
    if (isaSegment.length !== 105) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Envelope & Control",
          "Invalid ISA segment length.",
          "ERROR",
          "ISA",
          isaSegment
        )
      );
    }

    const isaElements = isaSegment.split(elementSeparator);
    if (isaElements.length !== 17) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Envelope & Control",
          "Invalid ISA segment - must have 16 elements.",
          "ERROR",
          "ISA",
          isaSegment
        )
      );
    }

    // Extract control numbers
    const isa13 = isaElements[13]?.trim();
    const ieaSegment = segments[segments.length - 1];
    const ieaElements = ieaSegment.split(elementSeparator);
    const iea02 = ieaElements[2]?.trim();

    // Rule 2: ISA13 = IEA02
    if (isa13 !== iea02) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Envelope & Control",
          "ISA13 and IEA02 mismatch.",
          "ERROR",
          "ISA/IEA",
          `ISA13:${isa13}, IEA02:${iea02}`
        )
      );
    }

    // Find GS and GE segments
    const gsSegments = segments.filter((s) =>
      s.startsWith("GS" + elementSeparator)
    );
    const geSegments = segments.filter((s) =>
      s.startsWith("GE" + elementSeparator)
    );

    for (let i = 0; i < gsSegments.length; i++) {
      const gsElements = gsSegments[i].split(elementSeparator);
      const geElements = geSegments[i]?.split(elementSeparator);

      const gs06 = gsElements[6]?.trim();
      const ge02 = geElements[2]?.trim();
      const ge01 = geElements[1]?.trim();

      // Rule 3: GS06 = GE02
      if (gs06 !== ge02) {
        validationErrors.push(
          await logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "GS/GE mismatch or invalid count.",
            "ERROR",
            "GS/GE",
            `GS06:${gs06}, GE02:${ge02}`
          )
        );
      }

      // Count ST-SE sets between this GS-GE pair
      const stSegments = segments.filter((s) =>
        s.startsWith("ST" + elementSeparator)
      );
      if (parseInt(ge01) !== stSegments.length) {
        validationErrors.push(
          await logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "GE01 does not match ST count.",
            "ERROR",
            "GE",
            `GE01:${ge01}, ST count:${stSegments.length}`
          )
        );
      }
    }

    // Rule 4 & 5: ST02 = SE02, SE01 = segment count, ST headers = SE trailers
    const stSegments = segments.filter((s) =>
      s.startsWith("ST" + elementSeparator)
    );
    const seSegments = segments.filter((s) =>
      s.startsWith("SE" + elementSeparator)
    );

    if (stSegments.length !== seSegments.length) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Envelope & Control",
          "Mismatched ST-SE count.",
          "ERROR",
          "ST/SE",
          `ST:${stSegments.length}, SE:${seSegments.length}`
        )
      );
    }

    for (let i = 0; i < stSegments.length; i++) {
      const stElements = stSegments[i].split(elementSeparator);
      const seElements = seSegments[i]?.split(elementSeparator);

      const st02 = stElements[2]?.trim();
      const se02 = seElements[2]?.trim();
      const se01 = seElements[1]?.trim();

      if (st02 !== se02) {
        validationErrors.push(
          await logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "ST/SE mismatch or incorrect segment count.",
            "ERROR",
            "ST/SE",
            `ST02:${st02}, SE02:${se02}`
          )
        );
      }

      // Count segments between ST and SE
      const stIndex = segments.indexOf(stSegments[i]);
      const seIndex = segments.indexOf(seSegments[i]);
      const segmentCount = seIndex - stIndex + 1;

      if (parseInt(se01) !== segmentCount) {
        validationErrors.push(
          await logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "SE01 segment count incorrect.",
            "ERROR",
            "SE",
            `SE01:${se01}, Actual:${segmentCount}`
          )
        );
      }
    }

    // Rule 6: Control numbers must be unique
    const controlNumbers = new Set();

    // Check ISA13
    if (controlNumbers.has(`ISA13:${isa13}`)) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Envelope & Control",
          "Duplicate control number detected.",
          "ERROR",
          "ISA13",
          isa13
        )
      );
    }
    controlNumbers.add(`ISA13:${isa13}`);

    // Check GS06
    gsSegments.forEach((gs) => {
      const gs06 = gs.split(elementSeparator)[6]?.trim();
      if (controlNumbers.has(`GS06:${gs06}`)) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "Duplicate control number detected.",
            "ERROR",
            "GS06",
            gs06
          )
        );
      }
      controlNumbers.add(`GS06:${gs06}`);
    });

    // Check ST02
    stSegments.forEach((st) => {
      const st02 = st.split(elementSeparator)[2]?.trim();
      if (controlNumbers.has(`ST02:${st02}`)) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Envelope & Control",
            "Duplicate control number detected.",
            "ERROR",
            "ST02",
            st02
          )
        );
      }
      controlNumbers.add(`ST02:${st02}`);
    });

    // ========================================================================
    // LOOP & HIERARCHY VALIDATIONS
    // ========================================================================

    const hlSegments = segments.filter((s) =>
      s.startsWith("HL" + elementSeparator)
    );
    const hlData = hlSegments.map((hl) => {
      const elements = hl.split(elementSeparator);
      return {
        hl01: elements[1]?.trim(), // HL ID
        hl02: elements[2]?.trim(), // Parent ID
        hl03: elements[3]?.trim(), // Level Code
        segment: hl,
      };
    });

    // Rule 7: HL01 sequential, HL02 valid parent
    const hlIds = new Set();
    hlData.forEach((hl, index) => {
      // Check sequential numbering
      if (parseInt(hl.hl01) !== index + 1) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Loop & Hierarchy",
            "Invalid HL numbering/parent.",
            "ERROR",
            "HL",
            `Expected HL01:${index + 1}, Got:${hl.hl01}`
          )
        );
      }

      // Check parent exists (except for first HL)
      if (index > 0 && hl.hl02 && !hlIds.has(hl.hl02)) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Loop & Hierarchy",
            "Invalid HL numbering/parent.",
            "ERROR",
            "HL",
            `Parent ${hl.hl02} does not exist`
          )
        );
      }

      hlIds.add(hl.hl01);
    });

    // Rule 8: HL03 role valid (20=Info Source, 22=Subscriber, 23=Patient)
    const validRoles = ["20", "22", "23"];
    hlData.forEach((hl) => {
      if (!validRoles.includes(hl.hl03)) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Loop & Hierarchy",
            "Invalid HL role code.",
            "ERROR",
            "HL",
            `Invalid HL03:${hl.hl03}, Valid:20,22,23`
          )
        );
      }
    });

    // Rule 9: 2000A → 2000B → 2000C order (20 → 22 → 23)
    const roleSequence = hlData.map((hl) => hl.hl03).join(",");
    if (!isValidHLSequence(roleSequence)) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Loop & Hierarchy",
          "Loop order incorrect.",
          "ERROR",
          "HL",
          `Sequence:${roleSequence}`
        )
      );
    }

    // Rule 10: LS must be paired with LE
    const lsSegments = segments.filter((s) =>
      s.startsWith("LS" + elementSeparator)
    );
    const leSegments = segments.filter((s) =>
      s.startsWith("LE" + elementSeparator)
    );

    if (lsSegments.length !== leSegments.length) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Loop & Hierarchy",
          "Unclosed LS/LE loop.",
          "ERROR",
          "LS/LE",
          `LS:${lsSegments.length}, LE:${leSegments.length}`
        )
      );
    }

    // ========================================================================
    // MANDATORY SEGMENTS VALIDATIONS
    // ========================================================================

    // Rule 11: BHT must exist inside ST-SE
    const stIndex = segments.findIndex((s) =>
      s.startsWith("ST" + elementSeparator)
    );
    const seIndex = segments.findIndex((s) =>
      s.startsWith("SE" + elementSeparator)
    );
    const bhtIndex = segments.findIndex((s) =>
      s.startsWith("BHT" + elementSeparator)
    );

    if (stIndex === -1 || seIndex === -1) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "ST or SE segment missing (required to validate BHT).",
          "ERROR",
          "BHT",
          "Cannot validate without ST and SE"
        )
      );
    } else if (bhtIndex === -1) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "BHT segment missing between ST and SE.",
          "ERROR",
          "BHT",
          "No BHT found"
        )
      );
    } else if (!(stIndex < bhtIndex && bhtIndex < seIndex)) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Segment Order",
          "BHT must appear between ST and SE.",
          "ERROR",
          "BHT",
          `BHT found at position ${bhtIndex}, but must be between ST (${stIndex}) and SE (${seIndex})`
        )
      );
    }

    // Rule 12: At least 1 CLM per claim
    const clmSegments = segments.filter((s) =>
      s.startsWith("CLM" + elementSeparator)
    );
    if (clmSegments.length === 0) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "Missing CLM segment.",
          "ERROR",
          "CLM",
          "No CLM found"
        )
      );
    }

    // Rule 13: NM1*85 Billing Provider required
    if (!segments.some((s) => s.startsWith("NM1" + elementSeparator + "85"))) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "Billing Provider NM1 missing.",
          "ERROR",
          "NM1*85",
          "Not found"
        )
      );
    }

    // Rule 14: NM1*IL Subscriber required
    if (!segments.some((s) => s.startsWith("NM1" + elementSeparator + "IL"))) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "Subscriber NM1 missing.",
          "ERROR",
          "NM1*IL",
          "Not found"
        )
      );
    }

    // Rule 15: NM1*QC Patient required (if ≠ subscriber) - check if HL03=23 exists
    const hasPatientLoop = hlData.some((hl) => hl.hl03 === "23");
    if (
      hasPatientLoop &&
      !segments.some((s) => s.startsWith("NM1" + elementSeparator + "QC"))
    ) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "Patient NM1 missing.",
          "ERROR",
          "NM1*QC",
          "Not found"
        )
      );
    }

    // Rule 16: NM1*PR Payer required
    if (!segments.some((s) => s.startsWith("NM1" + elementSeparator + "PR"))) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Mandatory Segments",
          "Payer NM1 missing.",
          "ERROR",
          "NM1*PR",
          "Not found"
        )
      );
    }

    // ========================================================================
    // SEGMENT SYNTAX & DATA ELEMENTS VALIDATIONS
    // ========================================================================

    // Rule 17: Segments must end with ~ terminator
    segments.forEach((segment, index) => {
      if (!fileContent.includes(segment + segmentTerminator)) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Segment Syntax",
            "Invalid segment termination.",
            "ERROR",
            `Segment ${index}`,
            segment.substring(0, 20)
          )
        );
      }
    });

    // Rule 18: Separators must match ISA
    const expectedElementSeparator = fileContent.charAt(3);

    // This is validated by parsing, but we can add explicit check
    if (elementSeparator !== expectedElementSeparator) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Segment Syntax",
          "Delimiter mismatch.",
          "ERROR",
          "Separators",
          "Element separator mismatch"
        )
      );
    }

    // Rule 19-24: Data element validations
    segments.forEach((segment) => {
      const segmentId = segment.substring(0, segment.indexOf(elementSeparator));
      const elements = segment.split(elementSeparator);

      // Rule 19: Mandatory elements not blank (segment-specific)
      // Rule 20: Dates CCYYMMDD (ISA date=YYMMDD)
      if (segmentId === "DTP") {
        const dtpDate = elements[3];
        if (dtpDate && elements[2] === "D8" && !/^\d{8}$/.test(dtpDate)) {
          validationErrors.push(
            logEdiValidation(
              client,
              fileId,
              "Data Elements",
              "Invalid date format.",
              "ERROR",
              "DTP",
              dtpDate
            )
          );
        }
      }

      // Rule 21: Times HHMM
      if (segmentId === "DTP" && elements[2] === "TM") {
        const dtpTime = elements[3];
        if (dtpTime && !/^\d{4}$/.test(dtpTime)) {
          validationErrors.push(
            logEdiValidation(
              client,
              fileId,
              "Data Elements",
              "Invalid time format.",
              "ERROR",
              "DTP",
              dtpTime
            )
          );
        }
      }

      // Rule 22: Monetary amounts numeric, 2 decimals
      if (segmentId === "CLM") {
        const claimAmount = elements[2];
        if (claimAmount && !/^\d+(\.\d{1,2})?$/.test(claimAmount)) {
          validationErrors.push(
            logEdiValidation(
              client,
              fileId,
              "Data Elements",
              "Invalid amount format.",
              "ERROR",
              "CLM02",
              claimAmount
            )
          );
        }
      }

      if (segmentId === "SV2") {
        const serviceAmount = elements[3];
        if (serviceAmount && !/^\d+(\.\d{1,2})?$/.test(serviceAmount)) {
          validationErrors.push(
            logEdiValidation(
              client,
              fileId,
              "Data Elements",
              "Invalid amount format.",
              "ERROR",
              "SV203",
              serviceAmount
            )
          );
        }
      }

      // Rule 24: Provider NPI = 10 digits
      if (segmentId === "NM1" && elements.length > 9) {
        const qualifierIndex = 8;
        const npiIndex = 9;
        if (elements[qualifierIndex] === "XX" && elements[npiIndex]) {
          const npi = elements[npiIndex];
          if (!/^\d{10}$/.test(npi)) {
            validationErrors.push(
              logEdiValidation(
                client,
                fileId,
                "Data Elements",
                "Invalid NPI length.",
                "ERROR",
                "NM109",
                npi
              )
            );
          }
        }
      }
    });

    // ========================================================================
    // BALANCING VALIDATIONS
    // ========================================================================

    // Rule 25: CLM02 = sum of SV203
    clmSegments.forEach((clmSegment) => {
      const clmElements = clmSegment.split(elementSeparator);
      const clmAmount = parseFloat(clmElements[2]) || 0;

      // Find corresponding service lines (between this CLM and next CLM or end)
      const clmSegmentIndex = segments.indexOf(clmSegment);
      const nextClmIndex = segments.findIndex(
        (s, i) => i > clmSegmentIndex && s.startsWith("CLM" + elementSeparator)
      );
      const endIndex = nextClmIndex === -1 ? segments.length : nextClmIndex;

      // Determine claim type by checking for BHT usage code before this CLM
      const bhtSegments = segments.filter((s) =>
        s.startsWith("BHT" + elementSeparator)
      );
      let claimType = "837I"; // Default to institutional

      if (bhtSegments.length > 0) {
        const bhtElements = bhtSegments[0].split(elementSeparator);
        const transactionTypeCode = bhtElements[6]?.trim();
        // BHT06 = Transaction Type Code: "RP"=Report (837I), "CH"=Chargeable (837P)
        claimType = transactionTypeCode === "CH" ? "837P" : "837I";
      }

      const serviceSegmentPrefix = claimType === "837P" ? "SV1" : "SV2";

      const serviceSegments = segments
        .slice(clmSegmentIndex, endIndex)
        .filter((s) => s.startsWith(serviceSegmentPrefix + elementSeparator));

      const totalServiceAmount = serviceSegments.reduce((sum, sv) => {
        const elements = sv.split(elementSeparator);
        const segmentId = elements[0];
        // SV1: charge at elements[2], SV2: charge at elements[3]
        const chargeIndex = segmentId === "SV1" ? 2 : 3;
        return sum + (parseFloat(elements[chargeIndex]) || 0);
      }, 0);

      if (Math.abs(clmAmount - totalServiceAmount) !== 0) {
        validationErrors.push(
          logEdiValidation(
            client,
            fileId,
            "Balancing",
            "Claim charges do not balance.",
            "ERROR",
            "CLM",
            `CLM02:${clmAmount}, ${serviceSegmentPrefix} Sum:${totalServiceAmount}`
          )
        );
      }
    });

    // Rule 26: # LX = # of service lines
    // Count SV1/SV2 segments that directly follow each LX segment
    let totalServiceLineCount = 0;
    const lxSegments = segments.filter((s) =>
      s.startsWith("LX" + elementSeparator)
    );

    // Use LX-1 value instead of counting LX segments
    const lxCount =
      lxSegments.length > 0
        ? parseInt(lxSegments[0].split(elementSeparator)[1]) || 0
        : 0;

    // For each LX segment, count consecutive SV1/SV2 segments that follow it
    lxSegments.forEach((lxSegment, lxIndex) => {
      const lxSegmentIndex = segments.indexOf(lxSegment);
      let serviceLineCount = 0;
      let nextIndex = lxSegmentIndex + 1;

      // Count consecutive SV1/SV2 segments after this LX until next non-service-line segment
      while (nextIndex < segments.length) {
        const segment = segments[nextIndex];
        if (
          segment.startsWith("SV1" + elementSeparator) ||
          segment.startsWith("SV2" + elementSeparator)
        ) {
          serviceLineCount++;
          nextIndex++;
        } else {
          break; // Stop counting when we hit a non-service-line segment
        }
      }

      totalServiceLineCount += serviceLineCount;
    });

    if (lxCount !== totalServiceLineCount) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Balancing",
          "Mismatch in LX/service line count.",
          "ERROR",
          "LX",
          `LX:${lxCount}, SV1/SV2:${totalServiceLineCount}`
        )
      );
    }

    // Rule 27: GE01 = # ST, IEA01 = # GS
    const iea01 = ieaElements[1]?.trim();
    if (parseInt(iea01) !== gsSegments.length) {
      validationErrors.push(
        await logEdiValidation(
          client,
          fileId,
          "Balancing",
          "Envelope counts mismatch.",
          "ERROR",
          "IEA",
          `IEA01:${iea01}, GS count:${gsSegments.length}`
        )
      );
    }

    // ========================================================================
    // SITUATIONAL VALIDATIONS
    // ========================================================================

    // Rule 28: REF*F8 required if CLM05-3=7/8 (replacement/void)
    clmSegments.forEach((clm) => {
      const elements = clm.split(elementSeparator);
      const clm05 = elements[5];
      if (clm05) {
        const clm05Parts = clm05.split(":");
        const claimFrequency = clm05Parts[2];
        if (["7", "8"].includes(claimFrequency)) {
          const clmIndex = segments.indexOf(clm);
          const nextClmIndex = segments.findIndex(
            (s, i) => i > clmIndex && s.startsWith("CLM" + elementSeparator)
          );
          const searchEnd =
            nextClmIndex === -1 ? segments.length : nextClmIndex;

          const hasRefF8 = segments
            .slice(clmIndex, searchEnd)
            .some((s) => s.startsWith("REF" + elementSeparator + "F8"));

          if (!hasRefF8) {
            validationErrors.push(
              logEdiValidation(
                client,
                fileId,
                "Situational",
                "Missing REF*F8 for replacement/void claim.",
                "ERROR",
                "REF*F8",
                "Required for CLM05-3=7/8"
              )
            );
          }
        }
      }
    });

    // Rule 29: REF*G1 required if prior auth needed (implementation depends on business rules)
    // This would require additional business logic to determine when prior auth is needed

    // Rule 30: If patient=subscriber, no Loop 2000C
    // This is a complex validation that requires comparing patient and subscriber NM1 segments
    // Implementation would need to compare demographic data between subscriber and patient loops

    // Rule 31: Facility NM1*FA/N3/N4 required if applicable
    // Additional logic would be needed to determine when facility is required based on claim type

    return {
      isValid: validationErrors.length === 0,
      errors: validationErrors,
      summary: {
        totalSegments: segments.length,
        claimCount: clmSegments.length,
        errorCount: validationErrors.length,
      },
    };
  } catch (error) {
    console.error("X12 validation error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse LLM JSON output safely.
 */
function safeParseJson(text) {
  if (!text) return null;
  // Try to extract JSON from text (in case model adds fences)
  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    const jsonString = text.slice(firstBrace);
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // fallback: try to eval loosely (not recommended in production)
      try {
        // remove trailing text after final brace
        const lastBrace = jsonString.lastIndexOf("}");
        const trimmed = jsonString.slice(0, lastBrace + 1);
        return JSON.parse(trimmed);
      } catch (e2) {
        logger.warn({ msg: "Failed to parse LLM JSON", err: e2.message });
        return null;
      }
    }
  }
  return null;
}

/**
 * systemPromptBuilder5010
 * Builds a concise, HIPAA 5010-compliant system prompt for 837P / 837I claims.
 * Dynamically detects claim type and adjusts segment validation context.
 */
export function systemPromptBuilder5010(parsedClaimJson = {}, claims) {
  const version = parsedClaimJson?.isa?.interchangeControlVersion;
  const is5010 = version.startsWith("00501");

  // --- Detect claim type ---
  let claimType = "837P"; // default
  let hasSV1 = false;
  let hasSV2 = false;
  for (const claim of claims) {
    for (const serviceLine of claim.serviceLines) {
      if (serviceLine.serviceLineType === "SV2") {
        hasSV2 = true;
      }
      if (serviceLine.serviceLineType === "SV1") {
        hasSV1 = true;
      }
    }
  }

  if (hasSV2 && !hasSV1) claimType = "837I";
  else if (parsedClaimJson.bht?.transactionTypeCode === "CH" && hasSV1)
    claimType = "837P";
  else if (parsedClaimJson.bht?.transactionTypeCode === "RP")
    claimType = "837I"; // CH=claim, RP=report
  else if (parsedClaimJson.bht?.transactionTypeCode === "31" || hasSV2)
    claimType = "837I";

  let prompt = `
You are a HIPAA X12 5010 EDI validation assistant.
Validate the parsed 837 ${
    claimType === "837I" ? "Institutional" : "Professional"
  } claim below
according to ASC X12N TR3 implementation rules.
Always apply official HIPAA 5010 logic.

=== GENERAL RULES ===
- Validate envelope (ISA, GS, GE, IEA), segment sequence, and syntax.
- Validate required segments, control numbers, and segment element rules.
- Return at most 5 issues.
- Always return valid JSON only (no markdown, no commentary).
`;

  // Envelope rules
  prompt += `
=== ENVELOPE RULES ===
- ISA segment defines delimiters (106 characters fixed).
- ISA12 must equal "00501" for HIPAA 5010.
- ISA13 = IEA02, GS06 = GE02, ST02 = SE02.
- SE01 = total segments from ST to SE inclusive.
- GE01 = number of ST-SE transactions, IEA01 = number of GS-GE groups.
`;
  if (is5010) {
    prompt += `
- ISA11 = repetition separator (non-alphanumeric, usually '^').
  Must not equal the element, component, or segment separator.
`;
  } else {
    prompt += `
- ISA11 = Interchange Standards Identifier ('U') for pre-5010 versions.
`;
  }

  // Claim-type context
  prompt += `
=== CLAIM TYPE CONTEXT ===
- Detected Claim Type: ${claimType}
`;
  if (claimType === "837P") {
    prompt += `
- This is an 837 Professional (837P) claim.
- Service line segments use SV1 with CPT/HCPCS codes.
- If an SV2 segment appears, treat it as equivalent to SV1 for validation purposes (allow CPT/HCPCS codes).
- Do NOT flag CPT codes as invalid in SV2 when claim type = 837P.
`;
  } else {
    prompt += `
- This is an 837 Institutional (837I) claim.
- Service line segments use SV2 with Revenue Codes.
- CPT/HCPCS codes inside SV2 are invalid for 837I.
`;
  }

  // CLM segment rules
  prompt += `
=== CLM SEGMENT RULES ===
- CLM05 has 3 sub-elements separated by colons:
  • CLM05-1 = Place of Service
  • CLM05-2 = Claim Frequency Type Code
  • CLM05-3 = Claim Frequency Code (valid: 1, 7, 8, A)
- Elements after CLM05 (CLM06–CLM09) are separate Y/A/N flags:
  • CLM06 = Provider signature
  • CLM07 = Assignment of benefits
  • CLM08 = Release of information
  • CLM09 = Patient signature
- Example valid:
  CLM*12345*1000***11:A:1*Y*A*Y*Y*~
  → CLM05-3 = 1 (original claim) ✅
  → CLM06–CLM09 = Y/A/Y/Y (not frequency codes)
`;

  // NM1, REF, HI, DTP segment rules
  prompt += `
=== COMMON SEGMENT RULES ===
NM1:
- NM108='XX' → NM109 must be 10-digit NPI.
- NM102=2 for Organization, 1 for Person.
- Example: NM1*85*2*GENERAL HOSPITAL*****XX*1234567893~

REF:
- REF01 = qualifier (EI, TJ, SY)
- REF02 = reference value (alphanumeric, 9 digits for EI)
- Do not duplicate NPI values.

HI:
- Each element uses a qualifier: ABK=ICD-10, BK=ICD-9.
- ICD-10 format: 1 letter + up to 6 digits.
- Ensure qualifiers match date of service (DTP).

DTP:
- DTP01='434' (statement period) or '472' (service date)
- DTP02='D8' (single) or 'RD8' (range)
- DTP03 must match date format.
`;

  // Service line logic based on claim type
  if (claimType === "837P") {
    prompt += `
SV1 (and SV2 if present):
- SV101-2 = CPT/HCPCS code (5 characters)
- SV102 = charge amount > 0
- SV104 = units > 0
- Do not raise an error for CPT codes inside SV2 when claim type = 837P.
`;
  } else {
    prompt += `
SV2:
- SV201 = Revenue Code (4 digits)
- SV202 = HCPCS/CPT may appear only when applicable
- CPT codes must not appear alone without a valid Revenue Code.
`;
  }
  prompt += `
NPI VALIDATION RULES (Important):
- When NM108 = "XX", NM109 should normally be a valid 10-digit NPI and pass the official Luhn Mod-10 checksum.
- However, if NM109 appears to be a synthetic or test/demo NPI (examples: "1234567890", "9999999999", repeated sequences, or values commonly used in payer test kits such as 1234567890, 0000000000, 1111111111, 9999999999), then DO NOT return an error.
- Instead, treat these NPIs as valid placeholders for testing unless the claim is specifically marked as production data.
`;

  // Output schema
  prompt += `
=== OUTPUT SCHEMA ===
Return valid JSON only:
{
  "issues": [
    { "segment": "string", "field": "string", "error": "string", "suggestion": "string", "confidence": 0.0 }
  ],
  "suggestions": [
    { "path": "dot.path.to.field", "newValue": "value", "reason": "string", "confidence": 0.0 }
  ],
  "suggested_fixed_claim": { ... corrected claim JSON ... }
}
If no issues exist, return empty arrays for issues and suggestions.
Limit to 5 issues max.
`;

  return prompt;
}

/**
 * validateWithLLM - performs contextual validation using a Large Language Model (OpenAI / Azure / HF)
 * @param {Object} parsedClaimJson
 * @returns {Object} structured JSON { issues, suggestions, suggested_fixed_claim }
 */
export async function validateWithLLM(
  fileName,
  fileId,
  parsedClaimJson,
  claims
) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
  const AZURE_OPENAI_API_VERSION =
    process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  const HF_API_URL = process.env.HF_API_URL;
  const HF_API_KEY = process.env.HF_API_KEY;

  const emptyResult = {
    issues: [],
    suggestions: [],
    suggested_fixed_claim: {},
  };
  const systemPrompt = systemPromptBuilder5010(parsedClaimJson, claims);

  const userPrompt = `
### Parsed 837 Claim JSON:
${JSON.stringify(parsedClaimJson, null, 2)}

### Instructions:
Validate the above claim and return strictly valid JSON.
`;
  try {
    let rawResponse = "";

    // 1️⃣ ---- Azure OpenAI ----
    if (
      AZURE_OPENAI_API_KEY &&
      AZURE_OPENAI_ENDPOINT &&
      AZURE_OPENAI_DEPLOYMENT
    ) {
      const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

      const body = {
        messages: [
          { role: "system", content: "You are a JSON-output-only assistant." },
          { role: "user", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 4000,
      };

      const response = await axios.post(url, body, {
        headers: {
          "api-key": AZURE_OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 90000,
      });

      const choices = response?.data?.choices;
      if (Array.isArray(choices)) {
        rawResponse = choices
          .map(
            (c) => c.message?.content?.trim() || c.delta?.content?.trim() || ""
          )
          .join("\n");
      } else {
        rawResponse =
          response?.data?.message?.content ||
          response?.data?.output_text ||
          JSON.stringify(response.data);
      }
    }

    // 2️⃣ ---- OpenAI Standard ----
    else if (OPENAI_API_KEY) {
      const response = await axios.post(
        url,
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a JSON-output-only assistant.",
            },
            { role: "user", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 90000,
        }
      );

      const choices = response?.data?.choices;
      if (Array.isArray(choices)) {
        rawResponse = choices
          .map(
            (c) => c.message?.content?.trim() || c.delta?.content?.trim() || ""
          )
          .join("\n");
      } else {
        rawResponse =
          response?.data?.message?.content ||
          response?.data?.output_text ||
          JSON.stringify(response.data);
      }
    }

    // 3️⃣ ---- Hugging Face Fallback ----
    else if (HF_API_URL && HF_API_KEY) {
      const hfResp = await axios.post(
        HF_API_URL,
        {
          inputs: `${systemPrompt}\n${userPrompt}`,
          parameters: {
            max_new_tokens: 1500,
            temperature: 0,
            return_full_text: false,
            stream: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 90000,
        }
      );

      const data = hfResp.data;
      if (Array.isArray(data)) {
        rawResponse = data
          .map((d) => d.generated_text || d.text || "")
          .join("\n");
      } else {
        rawResponse = data.generated_text || data.text || JSON.stringify(data);
      }
    }

    // ❌ No LLM Configured
    else {
      throw new Error(
        "No LLM provider configured (Azure, OpenAI, or Hugging Face)."
      );
    }

    // --- Clean & Save rawResponse for debugging ---
    const parsed = safeParseJson(rawResponse) || emptyResult;
    if (!Array.isArray(parsed.issues)) parsed.issues = [];
    if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
    if (typeof parsed.suggested_fixed_claim !== "object")
      parsed.suggested_fixed_claim = {};

    parsed.issues = parsed.issues.map((i) => ({
      ...i,
      confidence: typeof i.confidence === "number" ? i.confidence : 0.5,
    }));
    parsed.suggestions = parsed.suggestions.map((s) => ({
      ...s,
      confidence: typeof s.confidence === "number" ? s.confidence : 0.5,
    }));

    // Log individual issues and suggestions to EDIValidationLog
    const logClient = await pool.connect();
    try {
      await logClient.query("BEGIN");

      // Log each issue to EDIValidationLog
      for (const issue of parsed.issues) {
        await logEdiValidation(
          logClient,
          fileId,
          "LLM_SEMANTIC",
          `${issue.error}${
            issue.suggestion ? ` (Suggestion: ${issue.suggestion})` : ""
          }`,
          issue.confidence < 0.8 ? "WARNING" : "ERROR",
          issue.segment || "GENERAL",
          issue.field || "Unspecified"
        );
      }

      // Log each suggestion to EDIValidationLog
      for (const suggestion of parsed.suggestions) {
        await logEdiValidation(
          logClient,
          fileId,
          "LLM_SUGGESTION",
          `Suggestion: ${suggestion.reason}`,
          "INFO",
          "SUGGESTION",
          `${suggestion.path} -> ${suggestion.newValue}`
        );
      }

      await logClient.query("COMMIT");
    } catch (logError) {
      console.error("Error logging LLM validation details:", logError);
      await logClient.query("ROLLBACK");
    } finally {
      logClient.release();
    }

    parsed.isValid = true;
    await logFileValidation(
      fileName,
      "Validate with LLM",
      "INFO",
      `LLM validation completed successfully for File ID: ${fileId}`,
      fileId,
      JSON.stringify(parsed)
    );

    return parsed;
  } catch (err) {
    console.error("❌ LLM validation error:", err.message);
    await logFileValidation(
      fileName,
      "Validate with LLM",
      "ERROR",
      `LLM validation failed for File ID: ${fileId}`,
      fileId,
      err.message
    );
    return { ...emptyResult, isValid: false, error: err.message };
  }
}

/**
 * Log EDI validation errors
 */
async function logEdiValidation(
  client,
  fileId,
  validationType,
  errorMessage,
  severity,
  segmentId,
  errorLocation
) {
  const result = await client.query(
    `
    INSERT INTO EDIValidationLog (file_id, validation_type, segment_id, error_message, severity, error_location, validated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING validation_id
  `,
    [fileId, validationType, segmentId, errorMessage, severity, errorLocation]
  );

  return {
    validationId: result.rows[0].validation_id,
    validationType,
    segmentId,
    errorMessage,
    severity,
    errorLocation,
  };
}

/**
 * Validate HL sequence order (20 → 22 → optional 23)
 */
function isValidHLSequence(sequence) {
  // Valid patterns:
  // 20,22 (Billing Provider -> Subscriber, no patient)
  // 20,22,23 (Billing Provider -> Subscriber -> Patient)
  // 20,22,22,23,22,23 (Multiple subscribers with patients)

  const roles = sequence.split(",");

  // First must be 20 (Billing Provider)
  if (roles[0] !== "20") return false;

  // After 20, must have at least one 22
  if (!roles.includes("22")) return false;

  // Check that 23 (patient) only comes after 22 (subscriber)
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] === "23" && (i === 0 || roles[i - 1] !== "22")) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// PHASE 3: BUSINESS RULE VALIDATIONS
// ============================================================================

/**
 * Validate a claim against all active business rules
 */
export async function validateClaim(claimId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get claim data
    const claimResult = await pool.query(
      `
      SELECT ch.*,
             json_agg(DISTINCT cl.*) FILTER (WHERE cl.line_id IS NOT NULL) as service_lines,
             json_agg(DISTINCT cd.*) FILTER (WHERE cd.diagnosis_id IS NOT NULL) as diagnoses
      FROM ClaimHeader ch
      LEFT JOIN ClaimLine cl ON ch.claim_id = cl.claim_id
      LEFT JOIN ClaimDiagnosis cd ON ch.claim_id = cd.claim_id
      WHERE ch.claim_id = $1
      GROUP BY ch.claim_id
    `,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      throw new Error("Claim not found");
    }

    const claim = claimResult.rows[0];

    // Update claim status
    await client.query(
      "UPDATE ClaimHeader SET validation_status = $1 WHERE claim_id = $2",
      ["VALIDATING", claimId]
    );

    // Get active validation rules
    const rulesResult = await pool.query(
      `
      SELECT * FROM ValidationRules
      WHERE is_active = true
      AND (applies_to_payer IS NULL OR applies_to_payer = $1)
      AND (applies_to_facility IS NULL OR applies_to_facility = $2)
      ORDER BY priority DESC
    `,
      [claim.payer_id, claim.facility_id]
    );

    const rules = rulesResult.rows;
    const validationErrors = [];

    // Run each validation rule
    for (const rule of rules) {
      const error = await applyValidationRule(rule, claim);
      if (error) {
        validationErrors.push(error);

        // Insert validation log
        await client.query(
          `
          INSERT INTO BusinessValidationLog (
            claim_id, rule_id, rule_name, field_name,
            current_value, severity, error_code, error_message, suggestion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
          [
            claimId,
            rule.rule_id,
            rule.rule_name,
            rule.field_name,
            error.currentValue,
            rule.severity,
            rule.rule_code,
            error.message,
            error.suggestion,
          ]
        );
      }
    }

    // Update claim validation status
    const finalStatus = validationErrors.some((e) => e.severity === "ERROR")
      ? "FAILED"
      : "PASSED";

    await client.query(
      "UPDATE ClaimHeader SET validation_status = $1 WHERE claim_id = $2",
      [finalStatus, claimId]
    );

    await client.query("COMMIT");

    return {
      claimId,
      status: finalStatus,
      errorCount: validationErrors.filter((e) => e.severity === "ERROR").length,
      warningCount: validationErrors.filter((e) => e.severity === "WARNING")
        .length,
      errors: validationErrors,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply a single validation rule to a claim
 */
async function applyValidationRule(rule, claim) {
  const { rule_type, field_name, field_path, validation_logic } = rule;
  const logic =
    typeof validation_logic === "string"
      ? JSON.parse(validation_logic)
      : validation_logic;

  // Get field value from claim - prefer field_path over field_name
  const pathToUse = field_path || field_name;
  const fieldValue = getFieldValue(claim, pathToUse);

  // Handle array of values (from wildcard paths like serviceLines[*].procedureModifier1)
  const valuesToCheck = Array.isArray(fieldValue) ? fieldValue : [fieldValue];

  for (let i = 0; i < valuesToCheck.length; i++) {
    const value = valuesToCheck[i];

    switch (rule_type) {
      case "REQUIRED_FIELD":
        if (logic.required && (!value || value === "")) {
          return {
            fieldName: pathToUse,
            currentValue: value,
            message: rule.error_message_template,
            severity: rule.severity,
            suggestion: `Please provide a value for ${pathToUse}${
              Array.isArray(fieldValue) ? ` (item ${i + 1})` : ""
            }`,
            arrayIndex: Array.isArray(fieldValue) ? i : undefined,
          };
        }
        break;

      case "FORMAT":
        if (value && logic.pattern) {
          const regex = new RegExp(logic.pattern);
          if (!regex.test(value)) {
            return {
              fieldName: pathToUse,
              currentValue: value,
              message: rule.error_message_template,
              severity: rule.severity,
              suggestion: `Value must match pattern: ${logic.pattern}${
                Array.isArray(fieldValue) ? ` (item ${i + 1})` : ""
              }`,
              arrayIndex: Array.isArray(fieldValue) ? i : undefined,
            };
          }
        }
        break;

      case "RANGE":
        if (value) {
          const numValue = parseFloat(value);
          if (logic.min && numValue < logic.min) {
            return {
              fieldName: pathToUse,
              currentValue: value,
              message: rule.error_message_template,
              severity: rule.severity,
              suggestion: `Value must be at least ${logic.min}${
                Array.isArray(fieldValue) ? ` (item ${i + 1})` : ""
              }`,
              arrayIndex: Array.isArray(fieldValue) ? i : undefined,
            };
          }
          if (logic.max && numValue > logic.max) {
            return {
              fieldName: pathToUse,
              currentValue: value,
              message: rule.error_message_template,
              severity: rule.severity,
              suggestion: `Value must be at most ${logic.max}${
                Array.isArray(fieldValue) ? ` (item ${i + 1})` : ""
              }`,
              arrayIndex: Array.isArray(fieldValue) ? i : undefined,
            };
          }
        }
        break;

      case "LOOKUP":
        if (value && logic.validValues) {
          if (!logic.validValues.includes(value)) {
            return {
              fieldName: pathToUse,
              currentValue: value,
              message: rule.error_message_template,
              severity: rule.severity,
              suggestion: `Valid values: ${logic.validValues.join(", ")}${
                Array.isArray(fieldValue) ? ` (item ${i + 1})` : ""
              }`,
              arrayIndex: Array.isArray(fieldValue) ? i : undefined,
            };
          }
        }
        break;

      case "CUSTOM":
        // Implement custom validation logic
        // This would involve evaluating custom expressions
        break;
    }
  }

  return null;
}

/**
 * Get field value from claim object using dot notation with array wildcard support
 * Supports paths like: serviceLines[*].procedureModifier1
 */
function getFieldValue(claim, fieldPath) {
  if (!fieldPath) return null;

  // Check if path contains wildcard [*]
  if (fieldPath.includes("[*]")) {
    return getFieldValueWithWildcard(claim, fieldPath);
  }

  // Standard dot notation without wildcards
  const parts = fieldPath.split(".");
  let value = claim;

  for (const part of parts) {
    if (value && typeof value === "object") {
      value = value[part];
    } else {
      return null;
    }
  }

  return value;
}

/**
 * Get field values from nested arrays using wildcard notation
 * Example: serviceLines[*].procedureModifier1 returns all modifier1 values from all service lines
 */
function getFieldValueWithWildcard(claim, fieldPath) {
  const parts = fieldPath.split(".");
  const results = [];

  function traverse(obj, index) {
    if (index >= parts.length) return;

    const part = parts[index];

    if (part.includes("[*]")) {
      // Extract array name (e.g., "serviceLines" from "serviceLines[*]")
      const arrayKey = part.replace("[*]", "");
      const array = obj[arrayKey];

      if (!Array.isArray(array)) {
        return;
      }

      // Traverse each item in the array
      array.forEach((item) => {
        traverse(item, index + 1);
      });
    } else {
      // Regular property access
      if (index === parts.length - 1) {
        // Last part - collect the value
        if (obj && obj[part] !== undefined) {
          results.push(obj[part]);
        }
      } else if (obj && obj[part] !== undefined) {
        // Continue traversing
        traverse(obj[part], index + 1);
      }
    }
  }

  traverse(claim, 0);

  // Return array of values if wildcard was used, otherwise single value
  return results.length > 0 ? results : null;
}

/**
 * Validate batch of claims
 */
export async function validateBatch(claimIds) {
  const results = [];

  for (const claimId of claimIds) {
    try {
      const result = await validateClaim(claimId);
      results.push(result);
    } catch (error) {
      results.push({
        claimId,
        status: "ERROR",
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get validation summary for a claim
 */
export async function getValidationSummary(claimId) {
  const result = await pool.query(
    `
    SELECT
      bvl.validation_id,
      bvl.rule_name,
      bvl.field_name,
      bvl.current_value,
      bvl.severity,
      bvl.error_code,
      bvl.error_message,
      bvl.suggestion,
      bvl.validated_at,
      cl.correction_id,
      cl.new_value,
      cl.correction_type,
      cl.is_approved
    FROM BusinessValidationLog bvl
    LEFT JOIN CorrectionLog cl ON bvl.validation_id = cl.validation_id
    WHERE bvl.claim_id = $1
    ORDER BY bvl.severity DESC, bvl.validated_at DESC
  `,
    [claimId]
  );

  return result.rows;
}

/**
 * AI-assisted validation using Azure OpenAI
 */
export async function aiAssistedValidation(claimId) {
  try {
    // Get claim data
    const claimResult = await pool.query(
      `
      SELECT ch.*,
             json_agg(DISTINCT cl.*) FILTER (WHERE cl.line_id IS NOT NULL) as service_lines,
             json_agg(DISTINCT cd.*) FILTER (WHERE cd.diagnosis_id IS NOT NULL) as diagnoses
      FROM ClaimHeader ch
      LEFT JOIN ClaimLine cl ON ch.claim_id = cl.claim_id
      LEFT JOIN ClaimDiagnosis cd ON ch.claim_id = cd.claim_id
      WHERE ch.claim_id = $1
      GROUP BY ch.claim_id
    `,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      throw new Error("Claim not found");
    }

    const claim = claimResult.rows[0];

    // Get validation errors
    const errors = await getValidationSummary(claimId);

    if (errors.length === 0) {
      return { suggestions: [], message: "No validation errors found" };
    }

    // Prepare prompt for AI
    const prompt = `
You are a medical billing expert. Analyze this 837 claim and its validation errors, then suggest corrections.

Claim Details:
${JSON.stringify(claim, null, 2)}

Validation Errors:
${errors
  .map(
    (e) => `- ${e.field_name}: ${e.error_message} (Current: ${e.current_value})`
  )
  .join("\n")}

Please provide:
1. Root cause analysis of each error
2. Specific correction suggestions
3. Confidence level (0-1) for each suggestion

Format your response as JSON array with objects containing:
{
  "fieldName": "field name",
  "currentValue": "current value",
  "suggestedValue": "suggested correction",
  "reasoning": "explanation",
  "confidence": 0.95
}
`;

    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a medical billing expert assistant.",
        },
        { role: "user", content: prompt },
      ],
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const suggestions = JSON.parse(response.choices[0].message.content);

    return {
      suggestions,
      rawResponse: response.choices[0].message.content,
    };
  } catch (error) {
    console.error("AI validation error:", error);
    throw error;
  }
}

/**
 * Complete validation workflow: File → EDI → Business Rules
 */
export async function completeValidation(filePath, fileName, fileId = null) {
  const results = {
    fileValidation: null,
    ediValidation: null,
    businessValidation: null,
    overallStatus: "PASSED",
  };

  try {
    // Phase 1: File Import Validation
    results.fileValidation = await validateFileImport(
      filePath,
      fileName,
      null,
      fileId
    );

    if (!results.fileValidation.isValid) {
      results.overallStatus = "FAILED";
      return results;
    }

    // Phase 2: X12 EDI Structure Validation
    const fileContent = fs.readFileSync(filePath, "utf-8");
    results.ediValidation = await validateX12Structure(fileContent, fileId);

    if (!results.ediValidation.isValid) {
      results.overallStatus = "FAILED";
      return results;
    }

    // Phase 3: Business Rule Validation would happen after parsing
    // This would be called separately for each claim after parsing into database

    return results;
  } catch (error) {
    console.error("Complete validation error:", error);
    results.overallStatus = "ERROR";
    results.error = error.message;
    return results;
  }
}

export default {
  validateFileImport,
  validateX12Structure,
  validateClaim,
  validateBatch,
  getValidationSummary,
  aiAssistedValidation,
  validateWithLLM,
  logEdiValidation,
};
