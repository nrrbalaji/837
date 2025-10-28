import pool from "./backend/config/database.js";

async function checkParsedJSON() {
  const client = await pool.connect();

  try {
    console.log("=== Checking Parsed JSON for PRV and HI ===\n");

    const result = await client.query(`
      SELECT
        file_id,
        file_name,
        parsed_json
      FROM UploadFileDetail
      ORDER BY file_id DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("No files found");
      return;
    }

    const { file_id, file_name, parsed_json } = result.rows[0];
    console.log(`File: ${file_name} (${file_id})\n`);

    const firstClaim = parsed_json?.claims?.[0];
    const firstClaimData = firstClaim?.claims?.[0];

    console.log("=".repeat(70));
    console.log("\n📊 PRV SEGMENT DATA:\n");

    if (firstClaim?.billing?.providerInfo) {
      console.log("✅ Billing Provider Info FOUND:");
      console.log(JSON.stringify(firstClaim.billing.providerInfo, null, 2));
    } else {
      console.log("❌ Billing Provider Info: NOT FOUND in parsed_json");
    }

    console.log();

    if (firstClaim?.renderingProvider?.providerInfo) {
      console.log("✅ Rendering Provider Info FOUND:");
      console.log(JSON.stringify(firstClaim.renderingProvider.providerInfo, null, 2));
    } else {
      console.log("❌ Rendering Provider Info: NOT FOUND in parsed_json");
    }

    console.log("\n" + "=".repeat(70));
    console.log("\n📊 HI SEGMENT DATA:\n");

    if (firstClaimData?.diagnoses && firstClaimData.diagnoses.length > 0) {
      console.log(`✅ Diagnoses FOUND (${firstClaimData.diagnoses.length} total):`);
      firstClaimData.diagnoses.forEach((diag, i) => {
        console.log(`  ${i + 1}. ${diag.codeListQualifier}:${diag.code}`);
      });
    } else {
      console.log("❌ Diagnoses: NOT FOUND in parsed_json");
    }

    console.log("\n" + "=".repeat(70));
    console.log("\n🔍 CONCLUSION:\n");

    const prvExists = firstClaim?.billing?.providerInfo || firstClaim?.renderingProvider?.providerInfo;
    const hiExists = firstClaimData?.diagnoses?.length > 0;

    if (prvExists && hiExists) {
      console.log("✅ Both PRV and HI data exist in parsed_json!");
      console.log("\n   Problem: Data is parsed but not being used in generation.");
      console.log("   Solution: Update getGenerationReadyData() to use parsed_json.\n");
    } else if (prvExists && !hiExists) {
      console.log("⚠️  PRV data exists, but HI data is missing.");
      console.log("\n   Problem: Input file doesn't have HI segments.");
      console.log("   Solution: Upload files with diagnosis codes.\n");
    } else if (!prvExists && hiExists) {
      console.log("⚠️  HI data exists, but PRV data is missing.");
      console.log("\n   Problem: Input file doesn't have PRV segments.");
      console.log("   Solution: Input files need PRV segments after provider NM1.\n");
    } else {
      console.log("❌ Neither PRV nor HI data found in parsed_json.");
      console.log("\n   Problem: Input file is missing both segments.");
      console.log("   Solution: Check your source 837 files.\n");
    }

    console.log("=".repeat(70) + "\n");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkParsedJSON();
