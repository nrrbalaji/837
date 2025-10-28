/**
 * Verification script to test PER segment generation
 * Run this to verify the fix is working
 */

import { generate837File } from './backend/services/generate837.js';

// Sample parsed data with PER segment
const testData = {
  isa: {
    authorizationQualifier: "00",
    authorizationInformation: "          ",
    securityQualifier: "00",
    securityInformation: "          ",
    interchangeIdQualifier: "ZZ",
    interchangeSenderId: "SENDER",
    interchangeIdQualifier2: "ZZ",
    interchangeReceiverId: "RECEIVER",
    interchangeDate: "20241011",
    interchangeTime: "1430",
    interchangeControlStandards: "^",
    interchangeControlVersion: "00501",
    interchangeControlNumber: "000000001",
    acknowledgmentRequested: "0",
    usageIndicator: "T",
    componentElementSeparator: ":"
  },
  gs: {
    functionalIdentifierCode: "HC",
    applicationSenderCode: "SENDER",
    applicationReceiverCode: "RECEIVER",
    date: "20241011",
    time: "1430",
    groupControlNumber: "1",
    responsibleAgencyCode: "X",
    versionReleaseIndustryCode: "005010X222A1"
  },
  st: {
    transactionSetIdentifierCode: "837",
    transactionSetControlNumber: "0001",
    implementationConventionReference: "005010X222A1"
  },
  claims: [
    {
      bht: {
        hierarchicalStructureCode: "0019",
        transactionSetPurposeCode: "00",
        referenceIdentification: "1",
        date: "20241011",
        time: "1430",
        transactionTypeCode: "CH"
      },
      submitter: {
        entityIdentifierCode: "41",
        entityTypeQualifier: "2",
        lastName: "RYCAN",
        identificationCodeQualifier: "46",
        identificationCode: "12345",
        // Add contact information
        contacts: [
          {
            functionCode: "IC",
            name: "RYCAN",
            communicationQualifier1: "TE",
            communicationNumber1: "8002013324",
            communicationQualifier2: "EM",
            communicationNumber2: "edi@rycan.com",
            communicationQualifier3: "", // Empty
            communicationNumber3: "",     // Empty
            contactInquiryReference: ""   // Empty
          }
        ]
      },
      receiver: {
        entityIdentifierCode: "40",
        entityTypeQualifier: "2",
        lastName: "PAYER"
      },
      billing: {
        entityIdentifierCode: "85",
        entityTypeQualifier: "2",
        lastName: "PROVIDER"
      },
      subscriber: {},
      patient: {},
      claims: [
        {
          claimNumber: "TEST123",
          totalCharge: 100.00,
          placeOfService: "11",
          serviceLines: [],
          diagnoses: []
        }
      ]
    }
  ],
  ge: {
    numberOfTransactionSets: 1,
    groupControlNumber: "1"
  },
  iea: {
    numberOfFunctionalGroups: 1,
    interchangeControlNumber: "000000001"
  }
};

console.log("Generating 837 file with PER segment...\n");

try {
  const ediContent = await generate837File(testData);

  // Find the PER segment
  const lines = ediContent.split('\n');
  const perLine = lines.find(line => line.startsWith('PER*'));

  console.log("Generated PER segment:");
  console.log(perLine);
  console.log();

  // Check for trailing delimiters before the segment terminator
  if (perLine) {
    const beforeTerminator = perLine.split('~')[0];
    const hasTrailingDelimiters = beforeTerminator.endsWith('*');

    if (hasTrailingDelimiters) {
      console.log("❌ FAIL: PER segment has trailing delimiters");
      console.log("   This should be: PER*IC*RYCAN*TE*8002013324*EM*edi@rycan.com~");
      console.log("   But we got:     " + perLine);
    } else {
      console.log("✅ PASS: PER segment correctly formatted (no trailing delimiters)");
      console.log("   Expected: PER*IC*RYCAN*TE*8002013324*EM*edi@rycan.com~");
      console.log("   Got:      " + perLine);
    }
  } else {
    console.log("⚠️ WARNING: No PER segment found in generated content");
  }

} catch (error) {
  console.error("Error:", error.message);
}
