/**
 * 837 EDI File Validation Service
 * Implements HIPAA 5010 837I/837P validation rules
 * Based on X223 TR3 Implementation Guide
 */

import fs from "fs/promises";
import path from "path";

// Validation error severity levels
const SEVERITY = {
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
};

// Validation categories
const CATEGORY = {
  FILE_LEVEL: "FILE_LEVEL",
  ENVELOPE_CONTROL: "ENVELOPE_CONTROL",
  LOOP_HIERARCHY: "LOOP_HIERARCHY",
  MANDATORY_SEGMENTS: "MANDATORY_SEGMENTS",
  SEGMENT_SYNTAX: "SEGMENT_SYNTAX",
  DATA_ELEMENTS: "DATA_ELEMENTS",
  BALANCING: "BALANCING",
  SITUATIONAL: "SITUATIONAL",
};

/**
 * Phase 1: File Import Basic Validations
 */
export async function validateFileImport(filePath, fileName, fileSize) {
  const errors = [];
  // 1. Empty File
  if (fileSize === 0) {
    errors.push({
      validationName: "Empty File",
      category: CATEGORY.FILE_LEVEL,
      severity: SEVERITY.ERROR,
      errorCode: "FILE_003",
      errorMessage: "File is empty.",
      systemAction: "File rejected, status = ERROR",
      logTable: "FileValidationLog",
    });
    return { valid: false, errors };
  }

  // 2. File Size Exceeded
  if (fileSize > 50 * 1024 * 1024) {
    // 50 MB
    errors.push({
      validationName: "File Size Exceeded",
      category: CATEGORY.FILE_LEVEL,
      severity: SEVERITY.ERROR,
      errorCode: "FILE_001",
      errorMessage: "File size exceeds 50MB limit.",
      systemAction: "File rejected, status = ERROR",
      logTable: "FileValidationLog",
    });
    return { valid: false, errors };
  }

  // 3. Invalid File Extension
  const validExtensions = [".edi", ".837", ".txt"];
  const fileExt = path.extname(fileName).toLowerCase();
  if (!validExtensions.includes(fileExt)) {
    errors.push({
      validationName: "Invalid File Extension",
      category: CATEGORY.FILE_LEVEL,
      severity: SEVERITY.ERROR,
      errorCode: "FILE_002",
      errorMessage: `Invalid file extension. Allowed: ${validExtensions.join(
        ", "
      )}.`,
      systemAction: "File rejected, status = ERROR",
      logTable: "FileValidationLog",
    });
    return { valid: false, errors };
  }

  // Read first 120 characters to check ISA
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const first120 = fileContent.substring(0, 120);

    // 4. Missing ISA Segment
    if (!first120.startsWith("ISA")) {
      errors.push({
        validationName: "Missing ISA Segment",
        category: CATEGORY.FILE_LEVEL,
        severity: SEVERITY.ERROR,
        errorCode: "FILE_004",
        errorMessage: "Missing ISA segment in file.",
        systemAction: "File rejected, status = ERROR",
        logTable: "FileValidationLog",
      });
      return { valid: false, errors };
    }

    // Extract ISA segment (first 106 characters)
    const isaSegment = fileContent.substring(0, 106);
    const elementDelimiter = isaSegment.charAt(3); // ISA has delimiter at position 3
    const elements = isaSegment.split(elementDelimiter);

    // 5. Missing ISA13 (Control Number)
    if (!elements[13] || elements[13].trim() === "") {
      errors.push({
        validationName: "Missing ISA13",
        category: CATEGORY.FILE_LEVEL,
        severity: SEVERITY.ERROR,
        errorCode: "FILE_005",
        errorMessage: "ISA13 (Control Number) missing.",
        systemAction: "File rejected, status = ERROR",
        logTable: "FileValidationLog",
      });
      return { valid: false, errors };
    }

    const isa13 = elements[13].trim();

    // Note: Duplicate ISA13 check (FILE_006) requires database lookup
    // This will be done in the upload route before calling this function

    return {
      valid: errors.length === 0,
      errors,
      isa13,
      fileContent,
    };
  } catch (err) {
    errors.push({
      validationName: "File Read Error",
      category: CATEGORY.FILE_LEVEL,
      severity: SEVERITY.ERROR,
      errorCode: "FILE_999",
      errorMessage: `Unable to read file: ${err.message}`,
      systemAction: "File rejected, status = ERROR",
      logTable: "FileValidationLog",
    });
    return { valid: false, errors };
  }
}

/**
 * Phase 2: Expanded X12 Parser Validations
 * Based on 837I X223 TR3 guide
 */
export function validateX12Structure(fileContent) {
  const errors = [];
  const segmentDelimiter = "~";
  const segments = fileContent
    .split(segmentDelimiter)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Extract delimiters from ISA
  const isaSegment = segments[0];
  if (isaSegment.length < 106) {
    errors.push(
      createError(
        "EDI_001",
        CATEGORY.ENVELOPE_CONTROL,
        "Invalid ISA segment length."
      )
    );
    return { valid: false, errors };
  }

  const elementDelimiter = isaSegment.charAt(3);
  const subElementDelimiter = isaSegment.charAt(104);

  // 1. ISA must be 106 chars, 16 elements
  if (isaSegment.length !== 106) {
    errors.push(
      createError(
        "EDI_001",
        CATEGORY.ENVELOPE_CONTROL,
        "Invalid ISA segment length."
      )
    );
  }

  const isaElements = isaSegment.split(elementDelimiter);
  if (isaElements.length !== 16) {
    errors.push(
      createError(
        "EDI_001",
        CATEGORY.ENVELOPE_CONTROL,
        "ISA must have 16 elements."
      )
    );
  }

  // Extract control numbers
  const isa13 = isaElements[13]?.trim();
  const ieaSegment = segments.find((s) => s.startsWith("IEA"));
  const gsSegments = segments.filter((s) => s.startsWith("GS"));
  const geSegments = segments.filter((s) => s.startsWith("GE"));
  const stSegments = segments.filter((s) => s.startsWith("ST"));
  const seSegments = segments.filter((s) => s.startsWith("SE"));

  // 2. ISA13 = IEA02
  if (ieaSegment) {
    const ieaElements = ieaSegment.split(elementDelimiter);
    const iea02 = ieaElements[2]?.trim();
    if (isa13 !== iea02) {
      errors.push(
        createError(
          "EDI_002",
          CATEGORY.ENVELOPE_CONTROL,
          "ISA13 and IEA02 mismatch."
        )
      );
    }
  } else {
    errors.push(
      createError("EDI_002", CATEGORY.ENVELOPE_CONTROL, "Missing IEA segment.")
    );
  }

  // 3. GS06 = GE02, GE01 = # of ST-SE sets
  gsSegments.forEach((gsSegment, index) => {
    const gsElements = gsSegment.split(elementDelimiter);
    const gs06 = gsElements[6]?.trim();

    if (geSegments[index]) {
      const geElements = geSegments[index].split(elementDelimiter);
      const ge02 = geElements[2]?.trim();
      const ge01 = parseInt(geElements[1]?.trim());

      if (gs06 !== ge02) {
        errors.push(
          createError(
            "EDI_003",
            CATEGORY.ENVELOPE_CONTROL,
            `GS/GE mismatch. GS06=${gs06}, GE02=${ge02}`
          )
        );
      }

      // Count ST segments between this GS and GE
      // This is simplified - full implementation would track segment positions
    }
  });

  // 4. ST02 = SE02, SE01 = segment count
  stSegments.forEach((stSegment, index) => {
    const stElements = stSegment.split(elementDelimiter);
    const st02 = stElements[2]?.trim();

    if (seSegments[index]) {
      const seElements = seSegments[index].split(elementDelimiter);
      const se02 = seElements[2]?.trim();
      const se01 = parseInt(seElements[1]?.trim());

      if (st02 !== se02) {
        errors.push(
          createError(
            "EDI_004",
            CATEGORY.ENVELOPE_CONTROL,
            `ST/SE mismatch. ST02=${st02}, SE02=${se02}`
          )
        );
      }
    }
  });

  // 5. # of ST headers = # of SE trailers
  if (stSegments.length !== seSegments.length) {
    errors.push(
      createError(
        "EDI_005",
        CATEGORY.ENVELOPE_CONTROL,
        `Mismatched ST-SE count. ST=${stSegments.length}, SE=${seSegments.length}`
      )
    );
  }

  // 7-8. HL Segment Validations
  const hlSegments = segments.filter((s) => s.startsWith("HL"));
  validateHierarchyLoop(hlSegments, elementDelimiter, errors);

  // 11-16. Mandatory Segments
  validateMandatorySegments(segments, elementDelimiter, errors);

  // 17-18. Segment Syntax
  validateSegmentSyntax(
    fileContent,
    segmentDelimiter,
    elementDelimiter,
    errors
  );

  // 19-24. Data Elements
  validateDataElements(segments, elementDelimiter, errors);

  // 25-27. Balancing
  validateBalancing(segments, elementDelimiter, errors);

  // 28-31. Situational Requirements
  validateSituationalRequirements(segments, elementDelimiter, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings: errors.filter((e) => e.severity === SEVERITY.WARNING),
  };
}

/**
 * Helper function to create standardized error object
 */
function createError(code, category, message, severity = SEVERITY.ERROR) {
  return {
    errorCode: code,
    category,
    severity,
    errorMessage: message,
    systemAction: severity === SEVERITY.ERROR ? "Reject file" : "Log warning",
    logTable: "EdiValidationLog",
  };
}

/**
 * Validate HL (Hierarchical Level) segments
 */
function validateHierarchyLoop(hlSegments, delimiter, errors) {
  const hlData = hlSegments.map((seg) => {
    const elements = seg.split(delimiter);
    return {
      id: elements[1],
      parentId: elements[2],
      levelCode: elements[3],
      childCode: elements[4],
    };
  });

  // 7. HL01 sequential, HL02 valid parent
  hlData.forEach((hl, index) => {
    const expectedId = (index + 1).toString();
    if (hl.id !== expectedId) {
      errors.push(
        createError(
          "EDI_007",
          CATEGORY.LOOP_HIERARCHY,
          `Invalid HL numbering. Expected ${expectedId}, got ${hl.id}`
        )
      );
    }

    // Check parent exists (except for first HL)
    if (hl.parentId && index > 0) {
      const parentExists = hlData.some((h) => h.id === hl.parentId);
      if (!parentExists) {
        errors.push(
          createError(
            "EDI_007",
            CATEGORY.LOOP_HIERARCHY,
            `Invalid HL parent. HL${hl.id} references non-existent parent ${hl.parentId}`
          )
        );
      }
    }
  });

  // 8. HL03 role valid (20=Billing, 22=Subscriber, 23=Patient)
  const validCodes = ["20", "22", "23"];
  hlData.forEach((hl) => {
    if (!validCodes.includes(hl.levelCode)) {
      errors.push(
        createError(
          "EDI_008",
          CATEGORY.LOOP_HIERARCHY,
          `Invalid HL role code: ${hl.levelCode}`
        )
      );
    }
  });

  // 9. Check hierarchy order (20 → 22 → 23)
  const levelCodes = hlData.map((hl) => hl.levelCode);
  // Simplified check - full implementation would validate complete hierarchy
  if (levelCodes.length > 0 && levelCodes[0] !== "20") {
    errors.push(
      createError(
        "EDI_009",
        CATEGORY.LOOP_HIERARCHY,
        "Loop order incorrect. First HL must be 20 (Billing Provider)"
      )
    );
  }
}

/**
 * Validate mandatory segments
 */
function validateMandatorySegments(segments, delimiter, errors) {
  const segmentTypes = segments.map((s) => s.split(delimiter)[0]);

  // 11. BHT must exist
  if (!segmentTypes.includes("BHT")) {
    errors.push(
      createError(
        "EDI_011",
        CATEGORY.MANDATORY_SEGMENTS,
        "BHT segment missing."
      )
    );
  }

  // 12. At least 1 CLM per claim
  if (!segmentTypes.includes("CLM")) {
    errors.push(
      createError(
        "EDI_012",
        CATEGORY.MANDATORY_SEGMENTS,
        "Missing CLM segment."
      )
    );
  }

  // 13-16. Required NM1 segments
  const nm1Segments = segments.filter((s) => s.startsWith("NM1"));
  const nm1Codes = nm1Segments.map((s) => s.split(delimiter)[1]);

  if (!nm1Codes.includes("85")) {
    errors.push(
      createError(
        "EDI_013",
        CATEGORY.MANDATORY_SEGMENTS,
        "Billing Provider NM1*85 missing."
      )
    );
  }
  if (!nm1Codes.includes("IL")) {
    errors.push(
      createError(
        "EDI_014",
        CATEGORY.MANDATORY_SEGMENTS,
        "Subscriber NM1*IL missing."
      )
    );
  }
  if (!nm1Codes.includes("PR")) {
    errors.push(
      createError(
        "EDI_016",
        CATEGORY.MANDATORY_SEGMENTS,
        "Payer NM1*PR missing."
      )
    );
  }
}

/**
 * Validate segment syntax
 */
function validateSegmentSyntax(fileContent, segDelim, elemDelim, errors) {
  // 17. Segments must end with ~ terminator
  const lines = fileContent.split("\n");
  lines.forEach((line, index) => {
    if (line.trim() && !line.includes(segDelim)) {
      errors.push(
        createError(
          "EDI_017",
          CATEGORY.SEGMENT_SYNTAX,
          `Invalid segment termination at line ${index + 1}`
        )
      );
    }
  });
}

/**
 * Validate data elements
 */
function validateDataElements(segments, delimiter, errors) {
  segments.forEach((segment, segIndex) => {
    const elements = segment.split(delimiter);
    const segmentId = elements[0];

    // 20. Date format validation (CCYYMMDD for most, YYMMDD for ISA)
    if (segmentId === "DTP") {
      const dateValue = elements[3];
      const dateFormat = elements[2];
      if (dateFormat === "D8" && dateValue && !isValidDate(dateValue)) {
        errors.push(
          createError(
            "EDI_020",
            CATEGORY.DATA_ELEMENTS,
            `Invalid date format in DTP segment: ${dateValue}`
          )
        );
      }
    }

    // 24. Provider NPI = 10 digits
    if (segmentId === "NM1") {
      const idQualifier = elements[8];
      const idCode = elements[9];
      if (idQualifier === "XX" && idCode && idCode.length !== 10) {
        errors.push(
          createError(
            "EDI_024",
            CATEGORY.DATA_ELEMENTS,
            `Invalid NPI length: ${idCode} (must be 10 digits)`
          )
        );
      }
    }
  });
}

/**
 * Validate balancing rules
 */
function validateBalancing(segments, delimiter, errors) {
  // 25. CLM02 = sum of SV203 (for institutional) or SV102 (for professional)
  const clmSegments = segments.filter((s) => s.startsWith("CLM"));
  const svSegments = segments.filter(
    (s) => s.startsWith("SV1") || s.startsWith("SV2")
  );

  // This is simplified - full implementation would group by claim
  clmSegments.forEach((clm, index) => {
    const clmElements = clm.split(delimiter);
    const claimTotal = parseFloat(clmElements[2]);
    // Would need to sum related SV segments
  });

  // 26. # LX = # of service lines
  const lxSegments = segments.filter((s) => s.startsWith("LX"));
  // Compare with SV segments count

  // 27. GE01 = # ST, IEA01 = # GS
  const geSegments = segments.filter((s) => s.startsWith("GE"));
  const ieaSegments = segments.filter((s) => s.startsWith("IEA"));
  const stCount = segments.filter((s) => s.startsWith("ST")).length;
  const gsCount = segments.filter((s) => s.startsWith("GS")).length;

  geSegments.forEach((ge) => {
    const elements = ge.split(delimiter);
    const ge01 = parseInt(elements[1]);
    // Full implementation would validate counts match
  });
}

/**
 * Validate situational requirements
 */
function validateSituationalRequirements(segments, delimiter, errors) {
  // 28. REF*F8 required if CLM05-3=7/8 (replacement/void)
  const clmSegments = segments.filter((s) => s.startsWith("CLM"));
  clmSegments.forEach((clm) => {
    const elements = clm.split(delimiter);
    const clm05 = elements[5] || "";
    const frequencyCode = clm05.split(":")[2];

    if (frequencyCode === "7" || frequencyCode === "8") {
      // Check for REF*F8
      const refF8Exists = segments.some((s) => {
        const refElements = s.split(delimiter);
        return refElements[0] === "REF" && refElements[1] === "F8";
      });

      if (!refF8Exists) {
        errors.push(
          createError(
            "EDI_028",
            CATEGORY.SITUATIONAL,
            "Missing REF*F8 for replacement/void claim."
          )
        );
      }
    }
  });

  // 30. If patient=subscriber (SBR02=18), no Loop 2000C
  const sbrSegments = segments.filter((s) => s.startsWith("SBR"));
  sbrSegments.forEach((sbr) => {
    const elements = sbr.split(delimiter);
    const relationshipCode = elements[2];

    if (relationshipCode === "18") {
      // Check that there's no HL with level code 23 (Patient)
      const hlSegments = segments.filter((s) => s.startsWith("HL"));
      const hasPatientHL = hlSegments.some((hl) => {
        const hlElements = hl.split(delimiter);
        return hlElements[3] === "23";
      });

      if (hasPatientHL) {
        errors.push(
          createError(
            "EDI_030",
            CATEGORY.SITUATIONAL,
            "Patient loop incorrectly included when subscriber is patient (SBR02=18)."
          )
        );
      }
    }
  });
}

/**
 * Helper: Validate date format (CCYYMMDD)
 */
function isValidDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return false;

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}

export default {
  validateFileImport,
  validateX12Structure,
  SEVERITY,
  CATEGORY,
};
