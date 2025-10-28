import { generate837File } from "./backend/services/generate837.js";
import parsingService from "./backend/services/parsing837.js";
const { parseX12Content } = parsingService;

/**
 * Test HI segment generation
 */

const sample837WithHI = `ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*T*:~
GS*HC*SENDER*RECEIVER*20240101*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*1234*20240101*1200*CH~
NM1*41*2*SUBMITTER*****46*12345~
NM1*40*2*RECEIVER*****46*67890~
HL*1**20*1~
NM1*85*2*BILLING PROVIDER*****XX*1234567890~
HL*2*1*22*0~
SBR*P*18*******CI~
NM1*IL*1*SMITH*JOHN****MI*12345~
NM1*PR*2*INSURANCE COMPANY*****PI*INSCO~
CLM*CLAIM001*150.00***11:B:1*Y*A*Y*Y~
HI*ABK:Z1234*ABK:Z5678*ABK:Z9012~
LX*1~
SV1*HC:99213*75.00*UN*1*11**1~
LX*2~
SV1*HC:99214*75.00*UN*1*11**1~
SE*15*0001~
GE*1*1~
IEA*1*000000001~`;

async function testHIGeneration() {
  try {
    console.log("=== Testing HI Segment Generation ===\n");

    // Parse the sample file
    console.log("Step 1: Parsing sample 837 file...");
    const parsedData = parseX12Content(sample837WithHI);
    console.log(`✅ Parsed successfully`);
    console.log(`   Diagnoses in parsed data: ${parsedData.claims[0]?.claims[0]?.diagnoses?.length || 0}\n`);

    // Generate new 837 file
    console.log("Step 2: Generating 837 file from parsed data...");
    const outputPath = "./test_hi_generated.txt";
    const generatedContent = await generate837File(parsedData, outputPath);
    console.log(`✅ Generated successfully\n`);

    // Check for HI segments
    console.log("Step 3: Checking for HI segments in generated file...");
    const segments = generatedContent.split("~").map(s => s.trim()).filter(s => s);
    const hiSegments = segments.filter(s => s.startsWith("HI*"));

    console.log("\n" + "=".repeat(60));
    if (hiSegments.length > 0) {
      console.log(`\n✅ SUCCESS: Found ${hiSegments.length} HI segment(s) in generated file!\n`);
      hiSegments.forEach((seg, index) => {
        console.log(`HI Segment ${index + 1}:`);
        console.log(`  ${seg}\n`);

        // Parse and display
        const elements = seg.split("*").slice(1);
        elements.forEach((elem, i) => {
          console.log(`    Diagnosis ${i + 1}: ${elem}`);
        });
        console.log();
      });
    } else {
      console.log("\n❌ FAILURE: No HI segments found in generated file!\n");
      console.log("Generated segments:");
      segments.forEach((seg, i) => {
        console.log(`  ${i + 1}. ${seg.substring(0, 60)}${seg.length > 60 ? '...' : ''}`);
      });
    }
    console.log("=".repeat(60) + "\n");

    console.log(`Output file saved to: ${outputPath}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

testHIGeneration();
