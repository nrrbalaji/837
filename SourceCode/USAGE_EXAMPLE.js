/**
 * Usage Examples for Enhanced 837 Generation
 *
 * This file demonstrates how to use the new generation functions
 * in your existing workflow.
 */

import {
  generate837File,
  getGenerationReadyData,
  generate837FromClaim,
  validateRoundTrip
} from './backend/services/generate837.js';

// ============================================================================
// EXAMPLE 1: Current Usage (Unchanged - Still Works)
// ============================================================================

export async function example1_CurrentUsage(parsedData, outputPath) {
  console.log('Example 1: Generate from parsed data (existing workflow)');

  // This is the existing way - still works exactly the same
  const ediContent = await generate837File(parsedData, outputPath);

  console.log('✓ File generated:', outputPath);
  return ediContent;
}

// ============================================================================
// EXAMPLE 2: Generate from Corrected Claim (New Recommended Way)
// ============================================================================

export async function example2_GenerateFromCorrectedClaim(claimId, fileId) {
  console.log('Example 2: Generate 837 from corrected claim in database');

  const outputPath = `${process.env.OUTPUT_DIR}/claim_${claimId}_corrected.txt`;

  const result = await generate837FromClaim(claimId, fileId, outputPath);

  console.log('Generation result:');
  console.log('  Success:', result.success);
  console.log('  Valid:', result.validation.isValid);
  console.log('  Output:', result.outputPath);

  if (result.validation.differenceCount > 0) {
    console.warn('  Differences detected:');
    result.validation.differences.forEach(diff => {
      console.warn(`    ${diff.field}: ${diff.original} → ${diff.generated}`);
    });
  }

  return result;
}

// ============================================================================
// EXAMPLE 3: Update parsing837.js to Use New Validation
// ============================================================================

export async function example3_UpdatedParsingWorkflow(fileId, filePath) {
  console.log('Example 3: Updated parsing workflow with validation');

  // This shows how to update your parsing837.js file

  // Import the necessary functions
  const { parseX12Content } = await import('./backend/services/parsing837.js');
  const { validateX12Structure } = await import('./backend/services/validation.js');

  // Parse the file
  const fileContent = await fs.readFile(filePath, 'utf8');
  const parsedData = parseX12Content(fileContent);

  // Store in database (existing code)
  // ... database operations ...

  // NEW: Generate with validation after parsing
  console.log('Generating 837 file to verify parsing...');
  const outputPath = `${process.env.OUTPUT_DIR}/${fileId}.txt`;

  try {
    const ediContent = await generate837File(parsedData, outputPath);
    const validation = await validateRoundTrip(ediContent, parsedData);

    if (validation.isValid) {
      console.log('✓ Parsing verified - file can be regenerated correctly');
    } else {
      console.warn('⚠ Parsing issues detected:');
      validation.differences.forEach(d => console.warn(`  ${d.field}`));
    }
  } catch (error) {
    console.error('✗ Failed to regenerate file:', error.message);
  }

  return parsedData;
}

// ============================================================================
// EXAMPLE 4: API Endpoint for Generating Corrected Files
// ============================================================================

export async function example4_APIEndpoint(req, res) {
  console.log('Example 4: API endpoint usage');

  const { claimId } = req.params;
  const { fileId } = req.body;

  try {
    // Verify claim exists and has been validated
    const claimCheck = await pool.query(
      'SELECT validation_status, correction_status FROM ClaimHeader WHERE claim_id = $1',
      [claimId]
    );

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const claim = claimCheck.rows[0];

    if (claim.validation_status === 'NOT_VALIDATED') {
      return res.status(400).json({
        error: 'Claim must be validated before generation'
      });
    }

    // Generate the corrected 837 file
    const outputPath = `${process.env.OUTPUT_DIR}/claim_${claimId}_${Date.now()}.txt`;
    const result = await generate837FromClaim(claimId, fileId, outputPath);

    // Log the generation event
    await pool.query(`
      INSERT INTO GenerationLog (
        claim_id, file_id, generated_at, validation_status,
        output_path, difference_count, warning_count
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
    `, [
      claimId,
      fileId,
      result.validation.isValid ? 'PASSED' : 'FAILED',
      outputPath,
      result.validation.differenceCount,
      result.validation.warningCount
    ]);

    // Return response
    res.json({
      success: true,
      claimId,
      fileId,
      outputPath,
      validation: {
        isValid: result.validation.isValid,
        differenceCount: result.validation.differenceCount,
        warningCount: result.validation.warningCount,
        issues: [
          ...result.validation.differences,
          ...result.validation.warnings
        ]
      },
      downloadUrl: `/api/download/claim_${claimId}_${Date.now()}.txt`
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ============================================================================
// EXAMPLE 5: Batch Generation for Multiple Claims
// ============================================================================

export async function example5_BatchGeneration(claimIds, fileId) {
  console.log('Example 5: Batch generation for multiple claims');

  const results = {
    total: claimIds.length,
    successful: 0,
    failed: 0,
    details: []
  };

  for (const claimId of claimIds) {
    try {
      console.log(`\nProcessing claim ${claimId}...`);

      const outputPath = `${process.env.OUTPUT_DIR}/batch_claim_${claimId}.txt`;
      const result = await generate837FromClaim(claimId, fileId, outputPath);

      if (result.validation.isValid) {
        results.successful++;
        results.details.push({
          claimId,
          status: 'success',
          outputPath,
          validation: 'passed'
        });
      } else {
        results.failed++;
        results.details.push({
          claimId,
          status: 'failed',
          validation: 'failed',
          issues: result.validation.differences
        });
      }

    } catch (error) {
      results.failed++;
      results.details.push({
        claimId,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log('\n=== Batch Generation Complete ===');
  console.log(`Total: ${results.total}`);
  console.log(`✓ Successful: ${results.successful}`);
  console.log(`✗ Failed: ${results.failed}`);

  return results;
}

// ============================================================================
// EXAMPLE 6: Generate with Custom Modifications
// ============================================================================

export async function example6_CustomGeneration(claimId, fileId, modifications) {
  console.log('Example 6: Custom generation with modifications');

  // Step 1: Fetch corrected data from database
  const generationData = await getGenerationReadyData(claimId, fileId);

  // Step 2: Apply custom modifications
  if (modifications.newControlNumber) {
    generationData.isa.interchangeControlNumber = modifications.newControlNumber;
  }

  if (modifications.newGroupNumber) {
    generationData.gs.groupControlNumber = modifications.newGroupNumber;
  }

  if (modifications.updateSender) {
    generationData.isa.interchangeSenderId = modifications.senderId;
    generationData.gs.applicationSenderCode = modifications.senderCode;
  }

  // Step 3: Generate with modified data
  const outputPath = `${process.env.OUTPUT_DIR}/custom_claim_${claimId}.txt`;
  const ediContent = await generate837File(generationData, outputPath);

  // Step 4: Validate
  const validation = await validateRoundTrip(ediContent, generationData);

  console.log('Custom generation complete:');
  console.log('  Output:', outputPath);
  console.log('  Valid:', validation.isValid);

  return {
    ediContent,
    outputPath,
    validation
  };
}

// ============================================================================
// EXAMPLE 7: Error Handling Best Practices
// ============================================================================

export async function example7_ErrorHandling(claimId, fileId) {
  console.log('Example 7: Comprehensive error handling');

  try {
    // Validate inputs
    if (!claimId || !fileId) {
      throw new Error('claimId and fileId are required');
    }

    // Check claim exists
    const claimCheck = await pool.query(
      'SELECT claim_id FROM ClaimHeader WHERE claim_id = $1',
      [claimId]
    );

    if (claimCheck.rows.length === 0) {
      throw new Error(`Claim ${claimId} not found in database`);
    }

    // Check file exists
    const fileCheck = await pool.query(
      'SELECT file_id FROM UploadFileDetail WHERE file_id = $1',
      [fileId]
    );

    if (fileCheck.rows.length === 0) {
      throw new Error(`File ${fileId} not found in database`);
    }

    // Generate with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Generation timeout')), 60000)
    );

    const generationPromise = generate837FromClaim(claimId, fileId);

    const result = await Promise.race([generationPromise, timeoutPromise]);

    // Check validation
    if (!result.validation.isValid) {
      // Log issues
      await pool.query(`
        INSERT INTO GenerationErrors (
          claim_id, error_type, error_details, created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [
        claimId,
        'VALIDATION_FAILED',
        JSON.stringify(result.validation.differences)
      ]);

      throw new Error('Generated file failed validation');
    }

    return result;

  } catch (error) {
    console.error('Generation failed:', error.message);

    // Log error to database
    await pool.query(`
      INSERT INTO GenerationErrors (
        claim_id, error_type, error_message, created_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [claimId, 'GENERATION_ERROR', error.message]);

    // Re-throw for caller to handle
    throw error;
  }
}

// ============================================================================
// EXAMPLE 8: Integration with Correction Workflow
// ============================================================================

export async function example8_FullCorrectionWorkflow(claimId, fileId, userId) {
  console.log('Example 8: Complete correction and generation workflow');

  // Import correction service
  const { autoCorrectClaim, validateClaim } = await import('./backend/services/correction.js');

  // Step 1: Validate claim
  console.log('\n1. Validating claim...');
  const validationResult = await validateClaim(claimId);

  console.log(`   Status: ${validationResult.status}`);
  console.log(`   Errors: ${validationResult.errorCount}`);
  console.log(`   Warnings: ${validationResult.warningCount}`);

  // Step 2: Apply auto-corrections if there are errors
  if (validationResult.errorCount > 0) {
    console.log('\n2. Applying auto-corrections...');
    const correctionResult = await autoCorrectClaim(claimId, userId);

    console.log(`   Corrections applied: ${correctionResult.corrections.length}`);
    correctionResult.corrections.forEach(c => {
      console.log(`   - ${c.fieldName}: ${c.oldValue} → ${c.newValue}`);
    });
  } else {
    console.log('\n2. No corrections needed');
  }

  // Step 3: Re-validate after corrections
  console.log('\n3. Re-validating...');
  const revalidationResult = await validateClaim(claimId);

  if (revalidationResult.errorCount > 0) {
    console.log('   ⚠ Errors remain after auto-correction');
    console.log('   Manual review required');
    return {
      success: false,
      reason: 'Manual corrections required',
      errors: revalidationResult.errorCount
    };
  }

  // Step 4: Generate corrected 837
  console.log('\n4. Generating corrected 837 file...');
  const outputPath = `${process.env.OUTPUT_DIR}/corrected_${claimId}.txt`;
  const result = await generate837FromClaim(claimId, fileId, outputPath);

  console.log(`   Output: ${result.outputPath}`);
  console.log(`   Valid: ${result.validation.isValid}`);

  // Step 5: Update claim status
  await pool.query(`
    UPDATE ClaimHeader
    SET
      claim_status = 'READY_FOR_SUBMISSION',
      correction_status = 'CORRECTED',
      generated_file_path = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE claim_id = $2
  `, [outputPath, claimId]);

  console.log('\n✅ Workflow complete - claim ready for submission');

  return {
    success: true,
    claimId,
    outputPath,
    validation: result.validation,
    corrections: correctionResult?.corrections || []
  };
}

// ============================================================================
// Export all examples
// ============================================================================

export default {
  example1_CurrentUsage,
  example2_GenerateFromCorrectedClaim,
  example3_UpdatedParsingWorkflow,
  example4_APIEndpoint,
  example5_BatchGeneration,
  example6_CustomGeneration,
  example7_ErrorHandling,
  example8_FullCorrectionWorkflow
};
