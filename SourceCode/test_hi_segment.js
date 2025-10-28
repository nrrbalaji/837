import pool from "./backend/config/database.js";
import { generate837FromClaim } from "./backend/services/generate837.js";
import fs from "fs/promises";

/**
 * Test script to verify HI segment generation
 * This script checks if diagnoses are being properly fetched and included in 837 generation
 */

async function testHISegment() {
  const client = await pool.connect();

  try {
    console.log("=== Testing HI Segment Generation ===\n");

    // 1. Find a claim with diagnoses
    const claimResult = await client.query(`
      SELECT
        ch.claim_id,
        ch.file_id,
        ch.claim_number,
        COUNT(cd.diagnosis_id) as diagnosis_count
      FROM ClaimHeader ch
      LEFT JOIN ClaimDiagnosis cd ON ch.claim_id = cd.claim_id
      GROUP BY ch.claim_id, ch.file_id, ch.claim_number
      HAVING COUNT(cd.diagnosis_id) > 0
      ORDER BY ch.created_at DESC
      LIMIT 1
    `);

    if (claimResult.rows.length === 0) {
      console.log("❌ No claims with diagnoses found in database");
      return;
    }

    const claim = claimResult.rows[0];
    console.log(`✓ Found claim: ${claim.claim_number}`);
    console.log(`  - Claim ID: ${claim.claim_id}`);
    console.log(`  - File ID: ${claim.file_id}`);
    console.log(`  - Diagnosis Count: ${claim.diagnosis_count}\n`);

    // 2. Fetch diagnoses directly from database
    const diagnosesResult = await client.query(
      `SELECT * FROM ClaimDiagnosis WHERE claim_id = $1 ORDER BY diagnosis_sequence`,
      [claim.claim_id]
    );

    console.log("=== Diagnoses in Database ===");
    diagnosesResult.rows.forEach((diag, index) => {
      console.log(`${index + 1}. ${diag.diagnosis_type}:${diag.diagnosis_code} (Seq: ${diag.diagnosis_sequence})`);
    });
    console.log();

    // 3. Generate 837 file
    const outputPath = `./test_hi_output_${claim.claim_id}.txt`;
    console.log("=== Generating 837 File ===");
    const result = await generate837FromClaim(claim.claim_id, claim.file_id, outputPath);

    // 4. Check if HI segment exists in generated file
    const generatedContent = await fs.readFile(outputPath, "utf8");
    const segments = generatedContent.split("~").map(s => s.trim()).filter(s => s);

    const hiSegments = segments.filter(s => s.startsWith("HI*"));

    console.log("\n=== HI Segment Check ===");
    if (hiSegments.length > 0) {
      console.log(`✅ SUCCESS: Found ${hiSegments.length} HI segment(s)`);
      hiSegments.forEach((seg, index) => {
        console.log(`\n  HI Segment ${index + 1}:`);
        console.log(`  ${seg}`);

        // Parse and display diagnoses
        const elements = seg.split("*");
        elements.slice(1).forEach((elem, i) => {
          console.log(`    Diagnosis ${i + 1}: ${elem}`);
        });
      });
    } else {
      console.log("❌ FAILURE: No HI segments found in generated file");

      // Debug: Show all segments
      console.log("\n=== All Segments in Generated File ===");
      segments.forEach((seg, index) => {
        console.log(`${index + 1}. ${seg.substring(0, 50)}${seg.length > 50 ? '...' : ''}`);
      });
    }

    // 5. Check the parsed data structure
    console.log("\n=== Checking Generated Data Structure ===");
    const { getGenerationReadyData } = await import("./backend/services/generate837.js");
    const genData = await getGenerationReadyData(claim.claim_id, claim.file_id);

    const claimData = genData.claims[0]?.claims[0];
    if (claimData) {
      console.log(`Diagnoses in generated data structure: ${claimData.diagnoses?.length || 0}`);
      if (claimData.diagnoses && claimData.diagnoses.length > 0) {
        claimData.diagnoses.forEach((diag, index) => {
          console.log(`  ${index + 1}. ${diag.codeListQualifier}:${diag.code}`);
        });
      } else {
        console.log("⚠️  WARNING: No diagnoses in generated data structure!");
      }
    }

    console.log(`\n✅ Test output saved to: ${outputPath}`);

  } catch (error) {
    console.error("\n❌ Error during test:", error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testHISegment();
