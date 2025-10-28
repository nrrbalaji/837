import parsingService from "./backend/services/parsing837.js";
const { parseX12Content } = parsingService;

/**
 * Test HI segment parsing with sample data
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

console.log("=== Testing HI Segment Parsing ===\n");
console.log("Sample 837 file with HI segment:");
console.log(sample837WithHI);
console.log("\n" + "=".repeat(60) + "\n");

try {
  const parsed = parseX12Content(sample837WithHI);

  console.log("Parsed structure:");
  console.log(JSON.stringify(parsed, null, 2));

  // Check if diagnoses were parsed
  if (parsed.claims && parsed.claims.length > 0) {
    const claim = parsed.claims[0];
    if (claim.claims && claim.claims.length > 0) {
      const claimData = claim.claims[0];
      console.log("\n" + "=".repeat(60));
      console.log("\n✅ DIAGNOSIS CHECK:");
      console.log(`   Total diagnoses found: ${claimData.diagnoses?.length || 0}`);

      if (claimData.diagnoses && claimData.diagnoses.length > 0) {
        console.log("\n   Diagnoses:");
        claimData.diagnoses.forEach((diag, index) => {
          console.log(`   ${index + 1}. ${diag.codeListQualifier}:${diag.code} (Seq: ${diag.sequence})`);
        });
        console.log("\n✅ SUCCESS: HI segment parsed correctly!");
      } else {
        console.log("\n❌ FAILURE: No diagnoses found in parsed data!");
      }
    }
  }
} catch (error) {
  console.error("❌ Error parsing:", error.message);
  console.error(error.stack);
}
