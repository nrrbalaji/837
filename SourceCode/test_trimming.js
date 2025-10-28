/**
 * Test script to verify trimTrailingDelimiters works correctly
 */

const ELEMENT_DELIMITER = "*";

function trimTrailingDelimiters(segment) {
  if (!segment) return segment;

  // Remove trailing element delimiters (*)
  while (segment.endsWith(ELEMENT_DELIMITER)) {
    segment = segment.slice(0, -1);
  }

  return segment;
}

// Test cases
console.log("Testing trimTrailingDelimiters:\n");

const testCases = [
  {
    input: "PER*IC*RYCAN*TE*8002013324*EM*edi@rycan.com***",
    expected: "PER*IC*RYCAN*TE*8002013324*EM*edi@rycan.com",
    description: "PER with 3 trailing delimiters"
  },
  {
    input: "NM1*85*2*ACME****",
    expected: "NM1*85*2*ACME",
    description: "NM1 with 4 trailing delimiters"
  },
  {
    input: "REF*EI*123456789*",
    expected: "REF*EI*123456789",
    description: "REF with 1 trailing delimiter"
  },
  {
    input: "N3*123 MAIN ST*",
    expected: "N3*123 MAIN ST",
    description: "N3 with 1 trailing delimiter"
  },
  {
    input: "CLM*123*100.00",
    expected: "CLM*123*100.00",
    description: "CLM with no trailing delimiters"
  },
  {
    input: "SBR*P*18*****CI",
    expected: "SBR*P*18*****CI",
    description: "SBR with middle empty elements (should NOT trim)"
  }
];

testCases.forEach((test, index) => {
  const result = trimTrailingDelimiters(test.input);
  const passed = result === test.expected;

  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`  Input:    "${test.input}"`);
  console.log(`  Expected: "${test.expected}"`);
  console.log(`  Result:   "${result}"`);
  console.log(`  Status:   ${passed ? "✅ PASS" : "❌ FAIL"}`);
  console.log();
});

console.log("\nAll tests completed!");
