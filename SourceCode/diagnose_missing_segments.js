import pool from "./backend/config/database.js";
import fs from "fs/promises";

/**
 * DIAGNOSTIC TOOL: Find out why PRV and HI are missing in YOUR generated files
 * This will check YOUR actual data and show exactly what's missing
 */

async function diagnoseIssue() {
  const client = await pool.connect();

  try {
    console.log("=== DIAGNOSTIC REPORT FOR PRV & HI SEGMENTS ===\n");

    // 1. Check what files you have
    console.log("1️⃣  CHECKING YOUR FILES...\n");
    const files = await client.query(`
      SELECT file_id, file_name, upload_status
      FROM UploadFileDetail
      ORDER BY file_id DESC
      LIMIT 5
    `);

    if (files.rows.length === 0) {
      console.log("❌ No files found in database");
      return;
    }

    console.log(`Found ${files.rows.length} recent files:`);
    files.rows.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.file_name} (${f.upload_status}) - File ID: ${f.file_id}`);
    });

    const fileId = files.rows[0].file_id;
    console.log(`\n➡️  Analyzing most recent file: ${files.rows[0].file_name} (ID: ${fileId})\n`);

    // 2. Check for claims in this file
    console.log("2️⃣  CHECKING CLAIMS...\n");
    const claims = await client.query(`
      SELECT claim_id, claim_number
      FROM ClaimHeader
      WHERE file_id = $1
      LIMIT 5
    `, [fileId]);

    if (claims.rows.length === 0) {
      console.log("❌ No claims found for this file");
      return;
    }

    console.log(`Found ${claims.rows.length} claims`);
    const claimId = claims.rows[0].claim_id;
    const claimNumber = claims.rows[0].claim_number;
    console.log(`\n➡️  Checking claim: ${claimNumber} (ID: ${claimId})\n`);

    // 3. Check for DIAGNOSES (needed for HI segment)
    console.log("3️⃣  CHECKING DIAGNOSES (for HI segment)...\n");
    const diagnoses = await client.query(`
      SELECT diagnosis_code, diagnosis_type, diagnosis_sequence
      FROM ClaimDiagnosis
      WHERE claim_id = $1
      ORDER BY diagnosis_sequence
    `, [claimId]);

    if (diagnoses.rows.length === 0) {
      console.log("❌ NO DIAGNOSES FOUND!");
      console.log("   This is why HI segment is missing in generated files.\n");
      console.log("   ⚠️  ACTION NEEDED: Your source 837 files don't have HI segments,");
      console.log("       or they failed to parse. Check your input files.\n");
    } else {
      console.log(`✅ Found ${diagnoses.rows.length} diagnoses:`);
      diagnoses.rows.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.diagnosis_type}:${d.diagnosis_code}`);
      });
      console.log();
    }

    // 4. Check for PROVIDER INFO (needed for PRV segment)
    console.log("4️⃣  CHECKING PROVIDER INFORMATION (for PRV segment)...\n");

    const claim = await client.query(`
      SELECT
        ch.provider_id,
        ch.facility_id,
        p.npi as provider_npi,
        p.first_name,
        p.last_name,
        p.specialty,
        f.npi as facility_npi,
        f.facility_name
      FROM ClaimHeader ch
      LEFT JOIN Provider p ON ch.provider_id = p.provider_id
      LEFT JOIN Facilities f ON ch.facility_id = f.facility_id
      WHERE ch.claim_id = $1
    `, [claimId]);

    const claimData = claim.rows[0];

    console.log("Provider Information:");
    if (claimData.provider_npi) {
      console.log(`  ✅ Provider: ${claimData.first_name} ${claimData.last_name}`);
      console.log(`     NPI: ${claimData.provider_npi}`);
      console.log(`     Specialty: ${claimData.specialty || 'NOT SET'}`);

      if (!claimData.specialty) {
        console.log("\n   ⚠️  Provider has NO SPECIALTY/TAXONOMY CODE");
        console.log("       This is why PRV segment is missing!\n");
      }
    } else {
      console.log("  ❌ No provider linked to claim");
      console.log("     PRV segment requires provider information\n");
    }

    console.log("\nFacility Information:");
    if (claimData.facility_npi) {
      console.log(`  ✅ Facility: ${claimData.facility_name}`);
      console.log(`     NPI: ${claimData.facility_npi}`);
    } else {
      console.log("  ❌ No facility linked to claim");
    }

    // 5. Check the parsed JSON
    console.log("\n5️⃣  CHECKING PARSED JSON DATA...\n");
    const fileData = await client.query(`
      SELECT parsed_json
      FROM UploadFileDetail
      WHERE file_id = $1
    `, [fileId]);

    if (fileData.rows[0]?.parsed_json) {
      const parsed = fileData.rows[0].parsed_json;
      const firstClaim = parsed.claims?.[0];
      const firstClaimData = firstClaim?.claims?.[0];

      console.log("Parsed data contains:");
      console.log(`  - Billing Provider: ${firstClaim?.billing?.lastName || 'MISSING'}`);
      console.log(`  - Billing Provider Info: ${firstClaim?.billing?.providerInfo ? 'YES' : 'NO (PRV missing!)'}`);
      console.log(`  - Rendering Provider: ${firstClaim?.renderingProvider?.lastName || 'MISSING'}`);
      console.log(`  - Rendering Provider Info: ${firstClaim?.renderingProvider?.providerInfo ? 'YES' : 'NO (PRV missing!)'}`);
      console.log(`  - Diagnoses count: ${firstClaimData?.diagnoses?.length || 0} ${firstClaimData?.diagnoses?.length === 0 ? '(HI missing!)' : ''}`);
    }

    // 6. FINAL DIAGNOSIS
    console.log("\n" + "=".repeat(70));
    console.log("\n🔍 DIAGNOSIS & SOLUTION:\n");

    const issues = [];

    if (diagnoses.rows.length === 0) {
      issues.push({
        segment: "HI",
        problem: "No diagnoses in ClaimDiagnosis table",
        solution: "Your input 837 files don't have HI segments. Upload files WITH diagnosis codes."
      });
    }

    if (!claimData.provider_npi || !claimData.specialty) {
      issues.push({
        segment: "PRV",
        problem: "Provider missing or has no specialty/taxonomy code",
        solution: "Add taxonomy codes to Provider table, OR your input files need PRV segments."
      });
    }

    if (issues.length === 0) {
      console.log("✅ Data looks good! PRV and HI should be generated.");
      console.log("\n   If segments are still missing, the issue is in the generation logic.");
      console.log("   Run: node test_prv_hi_complete.js to verify generation works.\n");
    } else {
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.segment} SEGMENT MISSING:`);
        console.log(`   ❌ Problem: ${issue.problem}`);
        console.log(`   ✅ Solution: ${issue.solution}\n`);
      });
    }

    console.log("=".repeat(70) + "\n");

    // 7. Show sample input file
    console.log("6️⃣  CHECKING YOUR INPUT FILE...\n");

    const fileInfo = await client.query(`
      SELECT file_path FROM UploadFileDetail WHERE file_id = $1
    `, [fileId]);

    if (fileInfo.rows[0]?.file_path) {
      try {
        const content = await fs.readFile(fileInfo.rows[0].file_path, 'utf8');
        const hasPRV = content.includes('PRV*');
        const hasHI = content.includes('HI*');

        console.log("Your input file contains:");
        console.log(`  - PRV segments: ${hasPRV ? '✅ YES' : '❌ NO'}`);
        console.log(`  - HI segments: ${hasHI ? '✅ YES' : '❌ NO'}\n`);

        if (!hasPRV && !hasHI) {
          console.log("⚠️  YOUR INPUT FILES DON'T HAVE PRV OR HI SEGMENTS!");
          console.log("   The parser can't generate what doesn't exist in the source.\n");
        }
      } catch (err) {
        console.log("  (Could not read input file)");
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseIssue();
