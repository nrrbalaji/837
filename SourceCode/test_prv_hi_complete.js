import { generate837File } from "./backend/services/generate837.js";
import parsingService from "./backend/services/parsing837.js";
const { parseX12Content } = parsingService;

/**
 * Complete test for PRV and HI segments
 */

const sample837WithPRVandHI = `ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*T*:~
GS*HC*SENDER*RECEIVER*20240101*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*1234*20240101*1200*CH~
NM1*41*2*SUBMITTER*****46*12345~
NM1*40*2*RECEIVER*****46*67890~
HL*1**20*1~
NM1*85*2*BILLING PROVIDER*****XX*1234567890~
PRV*BI*PXC*207Q00000X~
HL*2*1*22*0~
SBR*P*18*******CI~
NM1*IL*1*SMITH*JOHN****MI*12345~
NM1*PR*2*INSURANCE COMPANY*****PI*INSCO~
CLM*CLAIM001*150.00***11:B:1*Y*A*Y*Y~
HI*ABK:Z1234*ABK:Z5678*ABK:Z9012~
NM1*82*1*DOE*JANE****XX*9876543210~
PRV*PE*PXC*208D00000X~
LX*1~
SV1*HC:99213*75.00*UN*1*11**1~
LX*2~
SV1*HC:99214*75.00*UN*1*11**1~
SE*20*0001~
GE*1*1~
IEA*1*000000001~`;

async function testPRVandHI() {
  try {
    console.log("=== Testing PRV and HI Segments ===\n");

    // Parse the sample file
    console.log("Step 1: Parsing sample 837 file with PRV and HI...");
    const parsedData = parseX12Content(sample837WithPRVandHI);
    console.log(`✅ Parsed successfully\n`);

    const claim = parsedData.claims[0];
    const claimData = claim?.claims[0];

    console.log("Parsed Data Summary:");
    console.log(`  - Billing Provider: ${claim.billing?.lastName || 'N/A'}`);
    console.log(`  - Billing PRV: ${claim.billing?.providerInfo?.providerTaxonomyCode || 'NOT FOUND'}`);
    console.log(`  - Rendering Provider: ${claim.renderingProvider?.lastName || 'N/A'}`);
    console.log(`  - Rendering PRV: ${claim.renderingProvider?.providerInfo?.providerTaxonomyCode || 'NOT FOUND'}`);
    console.log(`  - Diagnoses: ${claimData?.diagnoses?.length || 0}\n`);

    // Generate new 837 file
    console.log("Step 2: Generating 837 file from parsed data...");
    const outputPath = "./test_prv_hi_complete.txt";
    const generatedContent = await generate837File(parsedData, outputPath);
    console.log(`✅ Generated successfully\n`);

    // Check for PRV and HI segments
    console.log("Step 3: Checking generated segments...\n");
    const segments = generatedContent.split("~").map(s => s.trim()).filter(s => s);
    const prvSegments = segments.filter(s => s.startsWith("PRV*"));
    const hiSegments = segments.filter(s => s.startsWith("HI*"));

    console.log("=".repeat(70));

    // PRV Check
    if (prvSegments.length > 0) {
      console.log(`\n✅ PRV SEGMENTS: Found ${prvSegments.length} PRV segment(s)\n`);
      prvSegments.forEach((seg, index) => {
        console.log(`  PRV ${index + 1}: ${seg}`);
      });
    } else {
      console.log("\n❌ PRV SEGMENTS: NOT FOUND");
    }

    console.log("\n" + "-".repeat(70));

    // HI Check
    if (hiSegments.length > 0) {
      console.log(`\n✅ HI SEGMENTS: Found ${hiSegments.length} HI segment(s)\n`);
      hiSegments.forEach((seg, index) => {
        console.log(`  HI ${index + 1}: ${seg}`);
        const diagnoses = seg.split("*").slice(1);
        diagnoses.forEach((diag, i) => {
          console.log(`    Diagnosis ${i + 1}: ${diag}`);
        });
      });
    } else {
      console.log("\n❌ HI SEGMENTS: NOT FOUND");
    }

    console.log("\n" + "=".repeat(70));

    // Summary
    console.log("\n📋 SUMMARY:");
    console.log(`  ✓ PRV segments: ${prvSegments.length > 0 ? '✅ WORKING' : '❌ MISSING'}`);
    console.log(`  ✓ HI segments:  ${hiSegments.length > 0 ? '✅ WORKING' : '❌ MISSING'}`);
    console.log(`\n📁 Output file: ${outputPath}\n`);

    // Show complete generated file
    console.log("=".repeat(70));
    console.log("\n📄 COMPLETE GENERATED FILE:\n");
    console.log(generatedContent);
    console.log("\n" + "=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

testPRVandHI();
