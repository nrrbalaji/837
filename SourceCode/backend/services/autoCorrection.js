import pool from "../config/database.js";
import _ from "lodash";

/**
 * Auto-Correction Service for 837 Claims
 * Applies rule-based corrections to parsed JSON claims based on validation rules
 *
 * @module autoCorrection
 */

/**
 * Main auto-correction function
 * Fetches parsed_json, evaluates validation rules, and applies corrections
 *
 * @param {string} fileId - UUID of the file in UploadFileDetail
 * @param {Object} options - Optional configuration
 * @param {boolean} options.isTestMode - If true, returns preview without updating DB
 * @param {string} options.userId - User ID for audit logging
 * @returns {Promise<AutoCorrectionResponse>}
 */
export async function autoCorrectClaim(fileId, options = {}) {
  const { isTestMode = false, userId = null } = options;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Fetch the file record with parsed_json
    const fileResult = await client.query(
      `SELECT file_id, file_name, parsed_json, upload_status
       FROM UploadFileDetail
       WHERE file_id = $1`,
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }

    const fileRecord = fileResult.rows[0];

    if (!fileRecord.parsed_json) {
      throw new Error("No parsed JSON available for this file");
    }

    // Clone the JSON to work with
    let parsedJson = _.cloneDeep(fileRecord.parsed_json);

    // ✅ Extract claims from intermediate parsing structure
    // This converts claims[*].claims[*].serviceLines[*] → individual claim objects with serviceLines[*]
    const extractedClaims = extractClaims(parsedJson);
    console.log(`Extracted ${extractedClaims.length} claims from parsed data`);

    const correctionLog = [];

    // Step 2: Load validation rules - separate file-level from claim-level
    const validationRulesResult = await client.query(`
      SELECT
        rule_id, rule_code, rule_name, rule_type, rule_category,
        field_name, field_path, segment_code, element_position, loop_level,
        validation_logic, error_message_template, severity,
        auto_correct_enabled, applies_to_claim_type, applies_to_payer,
        applies_to_facility, priority
      FROM ValidationRules
      WHERE is_active = true
      ORDER BY priority ASC
    `);

    const allRules = validationRulesResult.rows;

    // Separate file-level rules (ISA, GS, ST) from claim-level rules
    const fileLevelRules = allRules.filter(
      (rule) =>
        rule.rule_category === "FILE" ||
        rule.field_path?.startsWith("isa.") ||
        rule.field_path?.startsWith("gs.") ||
        rule.field_path?.startsWith("st.") ||
        rule.segment_code === "ISA" ||
        rule.segment_code === "GS" ||
        rule.segment_code === "ST"
    );

    const claimLevelRules = allRules.filter(
      (rule) => rule.rule_category !== "FILE" && !fileLevelRules.includes(rule)
    );

    console.log(
      `Loaded ${fileLevelRules.length} file-level rules and ${claimLevelRules.length} claim-level rules`
    );

    // Step 2a: Validate file-level segments (ISA, GS, ST)
    if (fileLevelRules.length > 0) {
      console.log(`\n=== Validating File-Level Segments (ISA, GS, ST) ===`);

      for (const rule of fileLevelRules) {
        try {
          const validationResult = await evaluateValidationRule(
            parsedJson, // Use original parsed structure for file-level
            rule,
            client
          );

          if (!validationResult.isValid && rule.auto_correct_enabled) {
            console.log(
              `File-level validation failed for rule ${rule.rule_code}`
            );
            // TODO: Implement file-level correction if needed
            correctionLog.push({
              level: "FILE",
              rule_code: rule.rule_code,
              rule_name: rule.rule_name,
              target_path: rule.field_path || rule.segment_code,
              before_value: validationResult.currentValue,
              error_message: validationResult.errorMessage,
              correction_applied: false,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(
            `Error validating file-level rule ${rule.rule_code}:`,
            error
          );
        }
      }
    }

    // Step 3: Evaluate claim-level validation rules against each extracted claim
    for (
      let claimIndex = 0;
      claimIndex < extractedClaims.length;
      claimIndex++
    ) {
      let claimJson = extractedClaims[claimIndex];
      console.log(
        `\n=== Processing Claim ${claimIndex + 1}/${extractedClaims.length}: ${
          claimJson.claimNumber
        } ===`
      );

      for (const rule of claimLevelRules) {
        try {
          // Evaluate the validation rule against the claim JSON
          const validationResult = await evaluateValidationRule(
            claimJson,
            rule,
            client
          );

          // If rule fails AND auto_correct_enabled = true
          if (!validationResult.isValid && rule.auto_correct_enabled) {
            console.log(
              `Validation failed for rule ${rule.rule_code}, attempting auto-correction...`
            );

            // Step 4: Look for matching correction rule
            const correctionRuleResult = await client.query(
              `
              SELECT
                rule_id, rule_code, rule_name, validation_rule_id,
                correction_type, correction_source_type, correction_logic,
                lookup_table, lookup_column, default_value, fallback_strategy,
                requires_approval, is_test_mode, priority, is_active
              FROM CorrectionRules
              WHERE validation_rule_id = $1 AND is_active = true
              LIMIT 1
            `,
              [rule.rule_id]
            );

            if (correctionRuleResult.rows.length > 0) {
              const correctionRule = correctionRuleResult.rows[0];

              // Step 5: Apply the correction
              const correctionResult = await applyCorrectionRule(
                claimJson,
                rule,
                correctionRule,
                validationResult,
                client
              );

              if (correctionResult.success) {
                // Update the claimJson with corrected value
                claimJson = correctionResult.updatedJson;
                extractedClaims[claimIndex] = claimJson; // Update in array

                // Log the correction
                correctionLog.push({
                  claim_number: claimJson.claimNumber,
                  claim_index: claimIndex,
                  rule_code: rule.rule_code,
                  rule_name: rule.rule_name,
                  correction_rule_code: correctionRule.rule_code,
                  target_path:
                    rule.field_path ||
                    `${rule.segment_code}/${rule.element_position}`,
                  before_value: correctionResult.beforeValue,
                  corrected_value: correctionResult.afterValue,
                  correction_applied: true,
                  correction_source: correctionRule.correction_source_type,
                  correction_reason: correctionResult.reason,
                  timestamp: new Date().toISOString(),
                });

                console.log(`✓ Applied correction for rule ${rule.rule_code}`);
              } else {
                // Log failed correction attempt
                correctionLog.push({
                  claim_number: claimJson.claimNumber,
                  claim_index: claimIndex,
                  rule_code: rule.rule_code,
                  rule_name: rule.rule_name,
                  correction_rule_code: correctionRule.rule_code,
                  target_path:
                    rule.field_path ||
                    `${rule.segment_code}/${rule.element_position}`,
                  before_value: validationResult.currentValue,
                  corrected_value: null,
                  correction_applied: false,
                  error: correctionResult.error,
                  timestamp: new Date().toISOString(),
                });

                console.warn(
                  `✗ Failed to apply correction for rule ${rule.rule_code}: ${correctionResult.error}`
                );
              }
            } else {
              console.log(
                `No correction rule found for validation rule ${rule.rule_code}`
              );
            }
          }
        } catch (ruleError) {
          console.error(`Error processing rule ${rule.rule_code}:`, ruleError);
          correctionLog.push({
            claim_number: claimJson.claimNumber,
            claim_index: claimIndex,
            rule_code: rule.rule_code,
            rule_name: rule.rule_name,
            correction_applied: false,
            error: ruleError.message,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Step 6: Rebuild parsedJson structure with corrected claims
    // Put the corrected extracted claims back into the original parsedJson structure
    const correctedParsedJson = reconstructParsedJson(
      parsedJson,
      extractedClaims
    );

    // Step 6: Update database if not in test mode
    if (!isTestMode && correctionLog.some((log) => log.correction_applied)) {
      const correctionsApplied = correctionLog.filter(
        (l) => l.correction_applied
      ).length;
      const changeDescription = `Auto-correction applied ${correctionsApplied} correction(s) to ${extractedClaims.length} claim(s)`;

      // Get username if userId provided
      let username = "system";
      if (userId) {
        const userResult = await client.query(
          "SELECT username FROM Users WHERE user_id = $1",
          [userId]
        );
        username = userResult.rows[0]?.username || "system";
      }

      // Get current parsed_json before update
      const currentResult = await client.query(
        "SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1",
        [fileId]
      );
      const previousJson = currentResult.rows[0]?.parsed_json;

      // Prepare new JSON value - now save the corrected original structure directly
      const newJsonValue = correctedParsedJson;

      // Store the corrected extractedClaims back as parsed_json
      await client.query(
        `UPDATE UploadFileDetail
         SET parsed_json = $1
         WHERE file_id = $2`,
        [JSON.stringify(newJsonValue), fileId]
      );

      // Log the change to history log table
      const correctionLogIds = correctionLog
        .filter((l) => l.correction_applied)
        .map((l) => l.correction_id)
        .filter(Boolean);

      await client.query(
        `SELECT log_parsed_json_change(
          $1::UUID,
          $2::JSONB,
          $3::JSONB,
          $4::VARCHAR,
          $5::TEXT,
          $6::UUID,
          $7::VARCHAR,
          $8::VARCHAR,
          $9::JSONB,
          $10::UUID[]
        )`,
        [
          fileId,
          previousJson,
          newJsonValue,
          "AUTO_CORRECTION",
          changeDescription,
          userId,
          username,
          "AUTO_CORRECTION",
          JSON.stringify({
            totalCorrections: correctionsApplied,
            totalClaims: extractedClaims.length,
            correctionsApplied: correctionLog
              .filter((l) => l.correction_applied)
              .map((l) => ({
                ruleCode: l.rule_code,
                targetPath: l.target_path,
                beforeValue: l.before_value,
                afterValue: l.corrected_value,
              })),
          }),
          correctionLogIds,
        ]
      );

      // Log corrections to CorrectionLog table (for audit trail)
      for (const log of correctionLog.filter((l) => l.correction_applied)) {
        // Look up claim_id by claim_number if available
        let claimId = null;
        if (log.claim_number) {
          const claimLookup = await client.query(
            "SELECT claim_id FROM ClaimHeader WHERE claim_number = $1 AND file_id = $2 LIMIT 1",
            [log.claim_number, fileId]
          );
          claimId = claimLookup.rows[0]?.claim_id || null;
        }

        await client.query(
          `
          INSERT INTO CorrectionLog (
            claim_id, correction_type, field_name, field_path,
            old_value, new_value, correction_reason, correction_rule,
            corrected_by, corrected_at, is_approved
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, true)
        `,
          [
            claimId, // Now populated from ClaimHeader lookup
            "AUTO",
            log.rule_name,
            log.target_path,
            JSON.stringify(log.before_value),
            JSON.stringify(log.corrected_value),
            log.correction_reason,
            log.correction_rule_code,
            userId,
          ]
        );
      }

      console.log(
        `✓ Updated database with ${
          correctionLog.filter((l) => l.correction_applied).length
        } corrections`
      );
    }

    await client.query("COMMIT");

    // Step 7: Insert Auto-Correction history record
    const correctionsApplied = correctionLog.filter(
      (l) => l.correction_applied
    ).length;
    if (correctionsApplied > 0) {
      await client.query(
        `
        INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          fileId,
          `Auto-correction applied to ${correctionsApplied} correction(s) across ${extractedClaims.length} claim(s)`,
          "SUCCESS",
          "Auto Correction",
          userId,
        ]
      );
    } else {
      await client.query(
        `
        INSERT INTO ClaimHistory (file_id, notes, status, operation_type, user_detail)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          fileId,
          `Auto-correction completed, no corrections needed across ${extractedClaims.length} claim(s)`,
          "SUCCESS",
          "Auto Correction",
          userId,
        ]
      );
    }

    // Step 8: Build response
    const response = {
      status: "SUCCESS",
      fileId: fileId,
      fileName: fileRecord.file_name,
      totalClaims: extractedClaims.length,
      totalValidationRulesChecked: allRules.length,
      totalCorrectionsAttempted: correctionLog.length,
      totalCorrectionsApplied: correctionLog.filter(
        (log) => log.correction_applied
      ).length,
      totalCorrectionsFailed: correctionLog.filter(
        (log) => !log.correction_applied
      ).length,
      correctionLog: correctionLog,
      correctedClaims: isTestMode ? extractedClaims : null,
      isTestMode: isTestMode,
      timestamp: new Date().toISOString(),
    };

    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Auto-correction failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

function getNestedValueWithWildcard(json, path) {
  try {
    // Split nested wildcards like "claims[*].claims[*].totalCharge"
    const segments = path.split(".");
    const values = [];

    function traverse(obj, i) {
      if (i >= segments.length) return;

      const part = segments[i];

      if (part.includes("[*]")) {
        // Extract base name (e.g., "claims" from "claims[*]")
        const arrKey = part.replace("[*]", "");
        const arrayRef = obj[arrKey];

        if (!Array.isArray(arrayRef)) return;

        arrayRef.forEach((child) => {
          traverse(child, i + 1);
        });
      } else {
        if (i === segments.length - 1) {
          // Last segment → collect the value
          values.push(obj[part] ?? null);
        } else if (obj[part] !== undefined) {
          traverse(obj[part], i + 1);
        }
      }
    }

    traverse(json, 0);

    // Debug log
    console.log(`Resolved ${path} →`, values);

    return values;
  } catch (error) {
    console.error("Error in getNestedValueWithWildcard:", error);
    return [];
  }
}

function evaluateMultipleConditions(value, logic) {
  const operator = logic.logicOperator || "OR"; // Default OR
  let result = operator === "AND" ? true : false; // Initialize base result

  for (const condition of logic.conditions) {
    let conditionMet = false;

    switch (condition.type) {
      case "IS_EMPTY":
        conditionMet = value === null || value === undefined || value === "";
        break;

      case "LENGTH_LESS_THAN":
        conditionMet = String(value || "").length < condition.value;
        break;

      // ✅ Extendable for future conditions
      case "IS_NULL":
        conditionMet = value === null || value === undefined;
        break;

      case "EQUALS":
        conditionMet = String(value) === String(condition.value);
        break;

      default:
        conditionMet = false; // Unknown condition → ignore safely
    }

    // ✅ Apply OR / AND logic properly
    if (operator === "OR" && conditionMet) return true; // If ANY met → true
    if (operator === "AND" && !conditionMet) return false; // If ANY fails → false
  }

  // ✅ If loop completes, return aggregated result
  return operator === "AND";
}

function evaluateConditions(value, logic) {
  let result = logic.logicOperator === "AND" ? true : false;

  for (const condition of logic.conditions) {
    let conditionResult = true;

    switch (condition.type) {
      case "IS_EMPTY":
        conditionResult = value === null || value === undefined || value === "";
        break;
      case "LENGTH_LESS_THAN":
        conditionResult = String(value).length < condition.value;
        break;
      default:
        conditionResult = true;
    }

    if (logic.logicOperator === "OR" && conditionResult) return true;
    if (logic.logicOperator === "AND" && !conditionResult) return false;
  }

  return logic.logicOperator === "AND";
}

/**
 * Evaluate a validation rule against claim JSON
 *
 * @param {Object} claimJson - Parsed claim JSON
 * @param {Object} rule - Validation rule object
 * @param {Object} client - Database client
 * @returns {Promise<Object>} - { isValid: boolean, currentValue: any, errorMessage: string }
 */
async function evaluateValidationRule(claimJson, rule, client) {
  try {
    let currentValues = [];

    if (rule.field_path) {
      // ✅ Step 1 – Extract values with support for wildcard paths like claims[*].submitter.identificationCode
      if (rule.field_path.includes("[*]")) {
        currentValues = getNestedValueWithWildcard(claimJson, rule.field_path); // returns an array ✅
      } else {
        currentValues = [_.get(claimJson, rule.field_path, null)]; // normalize to array ✅
      }
    } else if (rule.segment_code && rule.element_position) {
      currentValues = [
        getSegmentElementValue(
          claimJson,
          rule.segment_code,
          rule.element_position,
          rule.loop_level
        ),
      ];
    } else {
      currentValues = [claimJson[rule.field_name]];
    }

    // ✅ Parse validation logic
    const validationLogic =
      typeof rule.validation_logic === "string"
        ? JSON.parse(rule.validation_logic)
        : rule.validation_logic;

    if (!validationLogic) {
      return { isValid: true, currentValue: currentValues, errorMessage: null };
    }

    // ✅ Step 2 – Loop through each value (for wildcard-based detection)
    for (const value of currentValues) {
      let isValid = true;
      let errorMessage = null;

      // ✅ Support for conditions with OR / AND logic
      if (
        validationLogic.conditions &&
        Array.isArray(validationLogic.conditions)
      ) {
        isValid = evaluateMultipleConditions(value, validationLogic);
        if (!isValid) {
          errorMessage = validationLogic.message || "Validation failed";
          return { isValid: false, currentValue: value, errorMessage };
        }
      } else {
        // ✅ Backward compatibility for single rule_type cases
        switch (rule.rule_type) {
          case "REQUIRED_FIELD":
            isValid = evaluateConditions(value, validationLogic.conditions);
            if (!isValid) errorMessage = "Required field is missing or empty";
            break;

          case "FORMAT":
            if (validationLogic.pattern) {
              const regex = new RegExp(validationLogic.pattern);
              isValid = regex.test(String(value));
              if (!isValid)
                errorMessage = `Value does not match format: ${validationLogic.pattern}`;
            }
            break;

          case "RANGE":
            const numValue = Number(value);
            if (validationLogic.min && numValue < validationLogic.min) {
              isValid = false;
              errorMessage = `Value ${numValue} is below minimum ${validationLogic.min}`;
            }
            if (validationLogic.max && numValue > validationLogic.max) {
              isValid = false;
              errorMessage = `Value ${numValue} is above maximum ${validationLogic.max}`;
            }
            break;

          default:
            isValid = true;
        }
      }

      if (!isValid) {
        return { isValid: false, currentValue: value, errorMessage };
      }
    }

    // ✅ If all values passed
    return { isValid: true, currentValue: currentValues, errorMessage: null };
  } catch (error) {
    console.error(`Error evaluating validation rule ${rule.rule_code}:`, error);
    return {
      isValid: true,
      currentValue: null,
      errorMessage: `Evaluation error: ${error.message}`,
    };
  }
}

/**
 * Apply a correction rule to the claim JSON
 *
 * @param {Object} claimJson - Parsed claim JSON
 * @param {Object} validationRule - The failed validation rule
 * @param {Object} correctionRule - The correction rule to apply
 * @param {Object} validationResult - Result from validation evaluation
 * @param {Object} client - Database client
 * @returns {Promise<Object>} - { success: boolean, updatedJson: Object, beforeValue: any, afterValue: any, reason: string }
 */
async function applyCorrectionRule(
  claimJson,
  validationRule,
  correctionRule,
  validationResult,
  client
) {
  try {
    const fieldPath = validationRule.field_path;
    let beforeValues = []; // ✅ Support multiple values for claims[*]
    let afterValues = [];
    let reason = "";

    // ✅ Parse correction logic
    const correctionLogic =
      typeof correctionRule.correction_logic === "string"
        ? JSON.parse(correctionRule.correction_logic)
        : correctionRule.correction_logic;

    // ✅ Detect wildcard path like claims[*].submitter.identificationCode
    if (fieldPath && fieldPath.includes("[*]")) {
      const [basePath, subPath] = fieldPath.split("[*].");
      const claimArray = _.get(claimJson, basePath, []);

      for (let i = 0; i < claimArray.length; i++) {
        const fullFieldPath = `${basePath}[${i}].${subPath}`;
        const beforeValue = _.get(claimJson, fullFieldPath, null);
        beforeValues.push(beforeValue);

        let correctedValue = await resolveCorrectionValue(
          correctionRule,
          correctionLogic,
          beforeValue,
          client,
          claimJson
        );

        afterValues.push(correctedValue);
        _.set(claimJson, fullFieldPath, correctedValue);
      }

      reason = `Applied correction to ${claimArray.length} items under ${fieldPath}`;
    } else {
      // ✅ Single field correction flow
      const beforeValue = _.get(claimJson, fieldPath, null);
      beforeValues.push(beforeValue);

      const correctedValue = await resolveCorrectionValue(
        correctionRule,
        correctionLogic,
        beforeValue,
        client,
        claimJson
      );

      afterValues.push(correctedValue);
      _.set(claimJson, fieldPath, correctedValue);
      reason = `Applied single correction to ${fieldPath}`;
    }

    return {
      success: true,
      updatedJson: claimJson,
      beforeValue: beforeValues,
      afterValue: afterValues,
      reason,
    };
  } catch (error) {
    console.error("❌ Error applying correction rule:", error);
    return {
      success: false,
      updatedJson: claimJson,
      beforeValue: validationResult.currentValue,
      afterValue: null,
      error: error.message,
      reason: "",
    };
  }
}

async function resolveCorrectionValue(
  correctionRule,
  correctionLogic,
  beforeValue,
  client,
  claimJson
) {
  let correctedValue = null;
  let sourceType = correctionRule.correction_source_type;

  switch (sourceType) {
    case "MASTER_PROVIDER":
    case "MASTER_FACILITY":
    case "MASTER_PAYER":
    case "MASTER_TRADING_PARTNER":
      correctedValue = await lookupMasterValue(
        correctionRule.lookup_table,
        correctionRule.lookup_column,
        correctionLogic,
        beforeValue,
        client,
        claimJson
      );
      break;

    case "STATIC":
      correctedValue = correctionRule.default_value;
      break;

    case "FORMAT_RULE":
      correctedValue = applyFormatTransformation(beforeValue, correctionLogic);
      break;

    case "FIELD_REFERENCE":
      const sourceField =
        correctionLogic?.sourceField || correctionLogic?.source_field;
      if (!sourceField)
        throw new Error("Source field not specified in correction logic");
      correctedValue = _.get(claimJson, sourceField, beforeValue);
      break;

    default:
      throw new Error(`Unknown correction source type: ${sourceType}`);
  }

  // ✅ Fallback handling
  if (
    !correctedValue &&
    correctionRule.fallback_strategy === "USE_DEFAULT" &&
    correctionRule.default_value
  ) {
    correctedValue = correctionRule.default_value;
  }

  return correctedValue;
}

/**
 * Lookup value from master table
 *
 * @param {string} table - Table name
 * @param {string} returnColumn - Column to return
 * @param {Object} logic - Correction logic with match criteria
 * @param {any} currentValue - Current value to match
 * @param {Object} client - Database client
 * @returns {Promise<any>} - Looked up value
 */
async function lookupMasterValue(
  table,
  returnColumn,
  logic,
  beforeValue,
  client,
  fullJsonContext
) {
  try {
    const matchColumn = logic?.matchColumn || "facility_name"; // ✅ facility_name
    const sourceJsonPath = logic?.useValueFrom; // ✅ claims[*].submitter.lastName

    let lookupValue = beforeValue;

    // ✅ Extract lastName if path provided
    if (sourceJsonPath) {
      lookupValue = _.get(
        fullJsonContext,
        sourceJsonPath.replace("[*]", "[0]"),
        beforeValue
      );
    }

    const query = `SELECT ${returnColumn} FROM ${table} WHERE ${matchColumn} ILIKE $1 LIMIT 1`;
    const result = await client.query(query, [lookupValue]);

    return result.rows.length > 0 ? result.rows[0][returnColumn] : null;
  } catch (err) {
    console.error("Lookup error:", err);
    return null;
  }
}

/**
 * Apply format transformation to a value
 *
 * @param {any} value - Value to transform
 * @param {Object} logic - Transformation logic
 * @returns {any} - Transformed value
 */
function applyFormatTransformation(value, logic) {
  if (!logic || !logic.transformType) {
    return value;
  }

  let result = value;

  switch (logic.transformType) {
    case "TRIM":
      result = String(value).trim();
      break;

    case "UPPERCASE":
      result = String(value).toUpperCase();
      break;

    case "LOWERCASE":
      result = String(value).toLowerCase();
      break;

    case "REMOVE_SPECIAL_CHARS":
      result = String(value).replace(/[^a-zA-Z0-9]/g, "");
      break;

    case "REMOVE_SPACES":
      result = String(value).replace(/\s+/g, "");
      break;

    case "FORMAT_PHONE":
      // Format to (XXX) XXX-XXXX
      const digits = String(value).replace(/\D/g, "");
      if (digits.length === 10) {
        result = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
          6
        )}`;
      }
      break;

    case "FORMAT_DATE":
      // Convert to YYYYMMDD or specified format
      const format = logic.format || "YYYYMMDD";
      result = formatDate(value, format);
      break;

    case "FORMAT_ZIP":
      // Format ZIP code
      const zipDigits = String(value).replace(/\D/g, "");
      if (zipDigits.length === 9) {
        result = `${zipDigits.slice(0, 5)}-${zipDigits.slice(5)}`;
      } else if (zipDigits.length === 5) {
        result = zipDigits;
      }
      break;

    case "DECIMAL_PLACES":
      const decimalPlaces = logic.decimals || 2;
      result = Number(value).toFixed(decimalPlaces);
      break;

    case "PAD_LEFT":
      const padLength = logic.length || 10;
      const padChar = logic.padChar || "0";
      result = String(value).padStart(padLength, padChar);
      break;

    case "PAD_RIGHT":
      const padLengthRight = logic.length || 10;
      const padCharRight = logic.padChar || " ";
      result = String(value).padEnd(padLengthRight, padCharRight);
      break;

    case "SUBSTRING":
      const start = logic.start || 0;
      const length = logic.length;
      result = String(value).substring(start, start + length);
      break;

    case "REPLACE":
      if (logic.pattern && logic.replacement !== undefined) {
        const regex = new RegExp(logic.pattern, logic.flags || "g");
        result = String(value).replace(regex, logic.replacement);
      }
      break;

    default:
      console.warn(`Unknown transform type: ${logic.transformType}`);
  }

  return result;
}

/**
 * Format date to specified format
 */
function formatDate(dateValue, format) {
  try {
    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
      return dateValue; // Return original if invalid
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (format) {
      case "YYYYMMDD":
        return `${year}${month}${day}`;
      case "YYYY-MM-DD":
        return `${year}-${month}-${day}`;
      case "MM/DD/YYYY":
        return `${month}/${day}/${year}`;
      default:
        return `${year}${month}${day}`;
    }
  } catch (error) {
    return dateValue;
  }
}

/**
 * Get nested value from JSON using dot notation path
 *
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path (e.g., "patient.demographics.firstName")
 * @returns {any} - Value at path or null
 */
function getNestedValue(obj, path) {
  if (!path || !obj) return null;
  return _.get(obj, path, null);
}

/**
 * Get value from segment/element position in 837 structure
 *
 * @param {Object} claimJson - Parsed claim JSON
 * @param {string} segmentCode - Segment code (e.g., "NM1", "REF")
 * @param {number} elementPosition - Element position (1-based)
 * @param {string} loopLevel - Loop level (e.g., "2000A", "2010AA")
 * @returns {any} - Value or null
 */
function getSegmentElementValue(
  claimJson,
  segmentCode,
  elementPosition,
  loopLevel
) {
  try {
    // Navigate through loops structure
    if (!claimJson.loops) return null;

    // Find the loop
    let targetLoop = null;
    if (loopLevel) {
      targetLoop = findLoop(claimJson.loops, loopLevel);
    } else {
      targetLoop = claimJson.loops;
    }

    if (!targetLoop) return null;

    // Find the segment
    const segments = Array.isArray(targetLoop)
      ? targetLoop
      : targetLoop.segments || [];
    const segment = segments.find(
      (seg) => seg.tag === segmentCode || seg.segmentCode === segmentCode
    );

    if (!segment) return null;

    // Get the element (1-based index)
    const elements = segment.elements || segment.data || [];
    return elements[elementPosition - 1] || null;
  } catch (error) {
    console.error("Error getting segment element value:", error);
    return null;
  }
}

/**
 * Find a loop by loop level in nested structure
 */
function findLoop(loops, loopLevel) {
  if (!loops || !loopLevel) return null;

  if (Array.isArray(loops)) {
    for (const loop of loops) {
      if (loop.loopId === loopLevel || loop.loop_id === loopLevel) {
        return loop;
      }
      if (loop.loops || loop.childLoops) {
        const found = findLoop(loop.loops || loop.childLoops, loopLevel);
        if (found) return found;
      }
    }
  } else if (typeof loops === "object") {
    if (loops.loopId === loopLevel || loops.loop_id === loopLevel) {
      return loops;
    }
    if (loops.loops || loops.childLoops) {
      return findLoop(loops.loops || loops.childLoops, loopLevel);
    }
  }

  return null;
}

/**
 * Update JSON field with new value
 *
 * @param {Object} json - JSON object to update
 * @param {string} fieldPath - Dot notation path
 * @param {string} segmentCode - Segment code (alternative to fieldPath)
 * @param {number} elementPosition - Element position (alternative to fieldPath)
 * @param {string} loopLevel - Loop level
 * @param {any} value - New value
 * @returns {Object} - Updated JSON (cloned)
 */
function updateJsonField(
  json,
  fieldPath,
  segmentCode,
  elementPosition,
  loopLevel,
  value
) {
  const clonedJson = _.cloneDeep(json);

  try {
    if (fieldPath && fieldPath.includes("[*]")) {
      // Example: claims[*].claims[*].totalCharge
      const segments = fieldPath.split(".");

      function applyUpdate(obj, i) {
        if (i >= segments.length) return;
        const part = segments[i];

        if (part.includes("[*]")) {
          const arrKey = part.replace("[*]", "");
          const arr = obj[arrKey];
          if (Array.isArray(arr)) {
            arr.forEach((child) => applyUpdate(child, i + 1));
          }
        } else {
          if (i === segments.length - 1) {
            // ✅ Apply update at final key
            obj[part] = value;
          } else if (obj[part] !== undefined) {
            applyUpdate(obj[part], i + 1);
          }
        }
      }

      applyUpdate(clonedJson, 0);
    } else if (fieldPath) {
      _.set(clonedJson, fieldPath, value);
    } else if (segmentCode && elementPosition) {
      updateSegmentElementValue(
        clonedJson,
        segmentCode,
        elementPosition,
        loopLevel,
        value
      );
    }
  } catch (error) {
    console.error("❌ Error updating JSON field:", error);
  }

  return clonedJson;
}

/**
 * Update segment element value in 837 structure
 */
function updateSegmentElementValue(
  claimJson,
  segmentCode,
  elementPosition,
  loopLevel,
  value
) {
  try {
    if (!claimJson.loops) return;

    let targetLoop = null;
    if (loopLevel) {
      targetLoop = findLoop(claimJson.loops, loopLevel);
    } else {
      targetLoop = claimJson.loops;
    }

    if (!targetLoop) return;

    const segments = Array.isArray(targetLoop)
      ? targetLoop
      : targetLoop.segments || [];
    const segment = segments.find(
      (seg) => seg.tag === segmentCode || seg.segmentCode === segmentCode
    );

    if (segment) {
      const elements = segment.elements || segment.data || [];
      if (elements.length >= elementPosition) {
        elements[elementPosition - 1] = value;
      }
    }
  } catch (error) {
    console.error("Error updating segment element:", error);
  }
}

/**
 * Evaluate custom condition
 */
function evaluateCondition(value, condition) {
  try {
    const { operator, expectedValue, compareField } = condition;

    switch (operator) {
      case "EQUALS":
        return value === expectedValue;
      case "NOT_EQUALS":
        return value !== expectedValue;
      case "CONTAINS":
        return String(value).includes(expectedValue);
      case "NOT_CONTAINS":
        return !String(value).includes(expectedValue);
      case "STARTS_WITH":
        return String(value).startsWith(expectedValue);
      case "ENDS_WITH":
        return String(value).endsWith(expectedValue);
      case "GREATER_THAN":
        return Number(value) > Number(expectedValue);
      case "LESS_THAN":
        return Number(value) < Number(expectedValue);
      case "IN":
        return Array.isArray(expectedValue) && expectedValue.includes(value);
      case "NOT_IN":
        return Array.isArray(expectedValue) && !expectedValue.includes(value);
      case "REGEX":
        const regex = new RegExp(expectedValue);
        return regex.test(String(value));
      default:
        return true;
    }
  } catch (error) {
    console.error("Error evaluating condition:", error);
    return false;
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
 * Reconstruct the original parsed JSON structure with corrected claims
 *
 * @param {Object} originalParsedJson - The original parsed JSON from the file
 * @param {Array} correctedExtractedClaims - Array of corrected claim objects
 * @returns {Object} - Reconstructed parsed JSON with corrections applied
 */
function reconstructParsedJson(originalParsedJson, correctedExtractedClaims) {
  try {
    // Clone the original structure to avoid modifying it directly
    const reconstructed = _.cloneDeep(originalParsedJson);

    // Create a map of claimNumber to corrected claim for efficient lookup
    const claimMap = new Map();
    correctedExtractedClaims.forEach((claim) => {
      claimMap.set(claim.claimNumber, claim);
    });

    // Navigate through the original structure and replace claims with corrected versions
    if (reconstructed.claims && Array.isArray(reconstructed.claims)) {
      for (
        let claimDataIndex = 0;
        claimDataIndex < reconstructed.claims.length;
        claimDataIndex++
      ) {
        const claimData = reconstructed.claims[claimDataIndex];

        if (claimData.claims && Array.isArray(claimData.claims)) {
          for (
            let claimIndex = 0;
            claimIndex < claimData.claims.length;
            claimIndex++
          ) {
            const originalClaim = claimData.claims[claimIndex];
            const claimNumber = originalClaim.claimNumber;

            // If we have a corrected version for this claim number, replace it
            if (claimNumber && claimMap.has(claimNumber)) {
              const correctedClaim = claimMap.get(claimNumber);
              // Replace the claim data while preserving other claim structure
              reconstructed.claims[claimDataIndex].claims[claimIndex] = {
                ...originalClaim,
                ...correctedClaim,
                // Keep the original claim number (it shouldn't change)
                claimNumber: claimNumber,
              };
            }
          }
        }
      }
    }

    console.log(
      `Reconstructed parsed JSON with ${correctedExtractedClaims.length} corrected claims`
    );
    return reconstructed;
  } catch (error) {
    console.error("Error reconstructing parsed JSON:", error);
    // Return original if reconstruction fails
    return originalParsedJson;
  }
}

/**
 * Export for external use
 */
export default {
  autoCorrectClaim,
};
