import pool from "../config/database.js";
import openai from "../config/openai.js";
import { autoCorrectClaim as autoCorrectClaimNew } from "./autoCorrection.js";

/**
 * Auto-Correction Service
 * Applies rule-based and AI-assisted corrections to claims
 */

/**
 * Auto-correct a claim based on validation errors
 * This is a wrapper that delegates to the new autoCorrection service
 *
 * @param {string} id - Can be either claimId (legacy) or fileId (new)
 * @param {string} userId - User ID for audit logging
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Correction results
 */
export async function autoCorrectClaim(id, userId, options = {}) {
  const client = await pool.connect();

  try {
    // Check if id is a fileId or claimId by querying UploadFileDetail
    const fileCheck = await client.query(
      "SELECT file_id FROM UploadFileDetail WHERE file_id = $1",
      [id]
    );

    if (fileCheck.rows.length > 0) {
      // It's a fileId - use new autoCorrection service
      console.log(`Using new auto-correction service for fileId: ${id}`);

      const result = await autoCorrectClaimNew(id, {
        isTestMode: options.isTestMode || false,
        userId: userId,
      });

      return result;
    }

    // Legacy path: It's a claimId - use old logic
    console.log(`Using legacy auto-correction for claimId: ${id}`);

    await client.query("BEGIN");

    // Get validation errors for the claim
    const errorsResult = await pool.query(
      `
      SELECT * FROM BusinessValidationLog
      WHERE claim_id = $1 AND severity = 'ERROR'
      ORDER BY validated_at DESC
    `,
      [id]
    );

    if (errorsResult.rows.length === 0) {
      await client.query("COMMIT");
      return { message: "No errors to correct", corrections: [] };
    }

    // Get active correction rules
    const rulesResult = await pool.query(`
      SELECT cr.*, vr.field_name
      FROM CorrectionRules cr
      LEFT JOIN ValidationRules vr ON cr.validation_rule_id = vr.rule_id
      WHERE cr.is_active = true
      ORDER BY cr.priority DESC
    `);

    const correctionRules = rulesResult.rows;
    const corrections = [];

    // Apply correction rules to each error
    for (const error of errorsResult.rows) {
      // Find applicable correction rule
      const rule = correctionRules.find(
        (r) => r.validation_rule_id === error.rule_id
      );

      if (rule && rule.requires_approval === false) {
        const correction = await applyCorrectionRule(
          client,
          id,
          error,
          rule,
          userId
        );
        if (correction) {
          corrections.push(correction);
        }
      }
    }

    // Update claim correction status
    await client.query(
      "UPDATE ClaimHeader SET correction_status = $1, updated_at = CURRENT_TIMESTAMP WHERE claim_id = $2",
      [corrections.length > 0 ? "AUTO_CORRECTED" : "MANUAL_REVIEW", id]
    );

    await client.query("COMMIT");

    return {
      message: `Applied ${corrections.length} auto-corrections`,
      corrections,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply a single correction rule
 */
async function applyCorrectionRule(client, claimId, error, rule, userId) {
  const { correction_type, correction_logic, field_name } = rule;
  const logic =
    typeof correction_logic === "string"
      ? JSON.parse(correction_logic)
      : correction_logic;

  let newValue = null;
  let correctionReason = "";

  switch (correction_type) {
    case "LOOKUP":
      // Look up value from master table
      newValue = await lookupValue(logic, error.current_value);
      correctionReason = `Looked up from ${logic.table} table`;
      break;

    case "DEFAULT_VALUE":
      newValue = logic.default;
      correctionReason = "Applied default value";
      break;

    case "CALCULATION":
      newValue = await calculateValue(logic, claimId);
      correctionReason = `Calculated using ${logic.function}`;
      break;

    case "AI_ASSISTED":
      // Will be handled separately as it requires approval
      return null;

    default:
      return null;
  }

  if (newValue === null) {
    return null;
  }

  // Apply the correction to the claim
  await updateClaimField(
    client,
    claimId,
    field_name,
    error.current_value,
    newValue
  );

  // Log the correction
  const correctionResult = await client.query(
    `
    INSERT INTO CorrectionLog (
      claim_id, validation_id, correction_type, field_name,
      old_value, new_value, correction_reason, correction_rule,
      corrected_by, is_approved
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING correction_id
  `,
    [
      claimId,
      error.validation_id,
      "AUTO",
      field_name,
      error.current_value,
      newValue,
      correctionReason,
      rule.rule_code,
      userId,
      true, // Auto-corrections are auto-approved
    ]
  );

  return {
    correctionId: correctionResult.rows[0].correction_id,
    fieldName: field_name,
    oldValue: error.current_value,
    newValue,
    reason: correctionReason,
  };
}

/**
 * Lookup value from master table
 */
async function lookupValue(logic, currentValue) {
  try {
    const { table, match_field, return_field } = logic;

    const result = await pool.query(
      `SELECT ${return_field} FROM ${table} WHERE ${match_field} = $1 LIMIT 1`,
      [currentValue]
    );

    return result.rows.length > 0 ? result.rows[0][return_field] : null;
  } catch (error) {
    console.error("Lookup error:", error);
    return null;
  }
}

/**
 * Calculate value based on logic
 */
async function calculateValue(logic, claimId) {
  const { function: funcName, params } = logic;

  switch (funcName) {
    case "formatDate":
      // Format date to specified format
      const date = new Date();
      return date.toISOString().split("T")[0]; // YYYY-MM-DD

    case "sumCharges":
      // Sum all line charges
      const result = await pool.query(
        "SELECT SUM(total_charge) as total FROM ClaimLine WHERE claim_id = $1",
        [claimId]
      );
      return result.rows[0].total;

    default:
      return null;
  }
}

/**
 * Update claim field value
 */
async function updateClaimField(
  client,
  claimId,
  fieldPath,
  oldValue,
  newValue
) {
  // Map field paths to database columns
  const fieldMappings = {
    provider_npi: "provider_id",
    payer_id: "payer_id",
    place_of_service: "place_of_service",
    service_date: "service_date_from",
    total_charge: "total_charge",
  };

  const dbField = fieldMappings[fieldPath] || fieldPath;

  await client.query(
    `UPDATE ClaimHeader SET ${dbField} = $1, updated_at = CURRENT_TIMESTAMP WHERE claim_id = $2`,
    [newValue, claimId]
  );
}

/**
 * Manual correction by user
 */
export async function manualCorrection(
  claimId,
  fieldName,
  newValue,
  reason,
  userId
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get current value
    const claimResult = await pool.query(
      "SELECT * FROM ClaimHeader WHERE claim_id = $1",
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      throw new Error("Claim not found");
    }

    const oldValue = claimResult.rows[0][fieldName];

    // Update the field
    await client.query(
      `UPDATE ClaimHeader SET ${fieldName} = $1, updated_at = CURRENT_TIMESTAMP WHERE claim_id = $2`,
      [newValue, claimId]
    );

    // Log the correction
    await client.query(
      `
      INSERT INTO CorrectionLog (
        claim_id, correction_type, field_name,
        old_value, new_value, correction_reason,
        corrected_by, is_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        claimId,
        "MANUAL",
        fieldName,
        oldValue,
        newValue,
        reason,
        userId,
        false, // Manual corrections need approval
      ]
    );

    // Insert history record
    await client.query(
      `
      INSERT INTO ClaimHistory (claim_id, notes, status, operation_type, user_detail)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        claimId,
        `Manual correction applied to field ${fieldName}: changed from '${oldValue}' to '${newValue}' (${reason})`,
        "SUCCESS",
        "Manual Correction",
        userId,
      ]
    );

    // Update claim status
    await client.query(
      "UPDATE ClaimHeader SET correction_status = $1 WHERE claim_id = $2",
      ["CORRECTED", claimId]
    );

    await client.query("COMMIT");

    return {
      message: "Manual correction applied",
      fieldName,
      oldValue,
      newValue,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * AI-assisted correction suggestions
 */
export async function aiAssistedCorrection(claimId) {
  try {
    // Get claim and error details
    const claimResult = await pool.query(
      `
      SELECT ch.*,
             json_agg(DISTINCT bvl.*) FILTER (WHERE bvl.validation_id IS NOT NULL) as errors
      FROM ClaimHeader ch
      LEFT JOIN BusinessValidationLog bvl ON ch.claim_id = bvl.claim_id
      WHERE ch.claim_id = $1
      GROUP BY ch.claim_id
    `,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      throw new Error("Claim not found");
    }

    const claim = claimResult.rows[0];
    const errors = claim.errors || [];

    if (errors.length === 0) {
      return { suggestions: [] };
    }

    // Build AI prompt
    const prompt = `
Analyze this medical claim and suggest corrections for the validation errors:

Claim: ${JSON.stringify(claim, null, 2)}

Errors:
${errors.map((e) => `- ${e.field_name}: ${e.error_message}`).join("\n")}

Provide correction suggestions in JSON format:
[
  {
    "fieldName": "...",
    "suggestedValue": "...",
    "confidence": 0.95,
    "reasoning": "..."
  }
]
`;

    const response = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a medical billing expert." },
        { role: "user", content: prompt },
      ],
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      temperature: 0.3,
      max_tokens: 1500,
    });

    const suggestions = JSON.parse(response.choices[0].message.content);

    // Store AI suggestions in correction log
    const client = await pool.connect();
    try {
      for (const suggestion of suggestions) {
        await client.query(
          `
          INSERT INTO CorrectionLog (
            claim_id, correction_type, field_name,
            new_value, correction_reason,
            ai_confidence_score, ai_reasoning, is_approved
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            claimId,
            "AI_ASSISTED",
            suggestion.fieldName,
            suggestion.suggestedValue,
            "AI-suggested correction",
            suggestion.confidence,
            suggestion.reasoning,
            false, // Requires approval
          ]
        );
      }
    } finally {
      client.release();
    }

    return { suggestions };
  } catch (error) {
    console.error("AI correction error:", error);
    throw error;
  }
}

/**
 * Get correction history for a claim
 */
export async function getCorrectionHistory(claimId) {
  const result = await pool.query(
    `
    SELECT
      cl.*,
      u.username as corrected_by_username,
      u2.username as approved_by_username
    FROM CorrectionLog cl
    LEFT JOIN Users u ON cl.corrected_by = u.user_id
    LEFT JOIN Users u2 ON cl.approved_by = u2.user_id
    WHERE cl.claim_id = $1
    ORDER BY cl.corrected_at DESC
  `,
    [claimId]
  );

  return result.rows;
}

export default {
  autoCorrectClaim,
  manualCorrection,
  aiAssistedCorrection,
  getCorrectionHistory,
};
