/**
 * Field Path Reference for Validation Rules
 *
 * Based on the extracted claim structure from parsing837.js
 * These paths are used to navigate the parsed JSON claim data during validation
 */

export interface FieldPathOption {
  label: string;
  value: string;
  category: string;
  description: string;
  dataType: string;
  example?: string;
}

/**
 * Complete field path reference for all accessible fields in parsed claims
 */
export const FIELD_PATHS: FieldPathOption[] = [
  // ====================
  // CLAIM HEADER FIELDS
  // ====================
  {
    label: 'Claim Number',
    value: 'claimNumber',
    category: 'Claim Header',
    description: 'Unique claim identifier',
    dataType: 'string',
    example: 'CLM-123456'
  },
  {
    label: 'Total Charge',
    value: 'totalCharge',
    category: 'Claim Header',
    description: 'Total billed amount for the claim',
    dataType: 'number',
    example: '250.00'
  },
  {
    label: 'Place of Service',
    value: 'placeOfService',
    category: 'Claim Header',
    description: 'Where services were rendered (2-digit code)',
    dataType: 'string',
    example: '11 (Office), 21 (Inpatient Hospital)'
  },
  {
    label: 'Claim Frequency Code',
    value: 'claimFrequencyCode',
    category: 'Claim Header',
    description: 'Frequency of claim submission',
    dataType: 'string',
    example: '1 (Original)'
  },
  {
    label: 'Claim Type',
    value: 'claimType',
    category: 'Claim Header',
    description: 'Professional or Institutional',
    dataType: 'string',
    example: 'Professional, Institutional'
  },

  // ====================
  // BILLING PROVIDER
  // ====================
  {
    label: 'Billing Provider - NPI',
    value: 'billing.identificationCode',
    category: 'Billing Provider',
    description: 'National Provider Identifier',
    dataType: 'string',
    example: '1234567890'
  },
  {
    label: 'Billing Provider - Last Name',
    value: 'billing.lastName',
    category: 'Billing Provider',
    description: 'Organization or provider last name',
    dataType: 'string',
    example: 'ABC Medical Center'
  },
  {
    label: 'Billing Provider - First Name',
    value: 'billing.firstName',
    category: 'Billing Provider',
    description: 'Provider first name (if individual)',
    dataType: 'string',
    example: 'John'
  },
  {
    label: 'Billing Provider - Tax ID',
    value: 'billing.taxId',
    category: 'Billing Provider',
    description: 'Federal Tax ID (EIN)',
    dataType: 'string',
    example: '12-3456789'
  },
  {
    label: 'Billing Provider - Address Line 1',
    value: 'billing.addressLine1',
    category: 'Billing Provider',
    description: 'Street address',
    dataType: 'string',
    example: '123 Main St'
  },
  {
    label: 'Billing Provider - City',
    value: 'billing.city',
    category: 'Billing Provider',
    description: 'City name',
    dataType: 'string',
    example: 'New York'
  },
  {
    label: 'Billing Provider - State',
    value: 'billing.state',
    category: 'Billing Provider',
    description: '2-letter state code',
    dataType: 'string',
    example: 'NY'
  },
  {
    label: 'Billing Provider - ZIP Code',
    value: 'billing.zipCode',
    category: 'Billing Provider',
    description: 'ZIP or ZIP+4',
    dataType: 'string',
    example: '10001 or 10001-1234'
  },

  // ====================
  // PATIENT INFORMATION
  // ====================
  {
    label: 'Patient - First Name',
    value: 'patient.firstName',
    category: 'Patient',
    description: 'Patient first name',
    dataType: 'string',
    example: 'Jane'
  },
  {
    label: 'Patient - Last Name',
    value: 'patient.lastName',
    category: 'Patient',
    description: 'Patient last name',
    dataType: 'string',
    example: 'Doe'
  },
  {
    label: 'Patient - Middle Name',
    value: 'patient.middleName',
    category: 'Patient',
    description: 'Patient middle name or initial',
    dataType: 'string',
    example: 'M'
  },
  {
    label: 'Patient - Date of Birth',
    value: 'patient.dateOfBirth',
    category: 'Patient',
    description: 'Patient DOB in YYYY-MM-DD format',
    dataType: 'date',
    example: '1985-03-15'
  },
  {
    label: 'Patient - Gender',
    value: 'patient.gender',
    category: 'Patient',
    description: 'M = Male, F = Female, U = Unknown',
    dataType: 'string',
    example: 'M, F, U'
  },
  {
    label: 'Patient - Address Line 1',
    value: 'patient.addressLine1',
    category: 'Patient',
    description: 'Patient street address',
    dataType: 'string',
    example: '456 Oak Ave'
  },
  {
    label: 'Patient - City',
    value: 'patient.city',
    category: 'Patient',
    description: 'Patient city',
    dataType: 'string',
    example: 'Los Angeles'
  },
  {
    label: 'Patient - State',
    value: 'patient.state',
    category: 'Patient',
    description: 'Patient state code',
    dataType: 'string',
    example: 'CA'
  },
  {
    label: 'Patient - ZIP Code',
    value: 'patient.zipCode',
    category: 'Patient',
    description: 'Patient ZIP code',
    dataType: 'string',
    example: '90001'
  },

  // ====================
  // SUBSCRIBER INFORMATION
  // ====================
  {
    label: 'Subscriber - First Name',
    value: 'subscriber.firstName',
    category: 'Subscriber',
    description: 'Insurance subscriber first name',
    dataType: 'string',
    example: 'John'
  },
  {
    label: 'Subscriber - Last Name',
    value: 'subscriber.lastName',
    category: 'Subscriber',
    description: 'Insurance subscriber last name',
    dataType: 'string',
    example: 'Smith'
  },
  {
    label: 'Subscriber - Date of Birth',
    value: 'subscriber.dateOfBirth',
    category: 'Subscriber',
    description: 'Subscriber DOB',
    dataType: 'date',
    example: '1980-06-20'
  },
  {
    label: 'Subscriber - Member ID',
    value: 'subscriber.identificationCode',
    category: 'Subscriber',
    description: 'Insurance member/subscriber ID',
    dataType: 'string',
    example: 'ABC123456789'
  },

  // ====================
  // SERVICE LINE FIELDS (Use [*] for array notation)
  // ====================
  {
    label: 'Service Line - Procedure Code',
    value: 'serviceLines[*].procedureCode',
    category: 'Service Lines',
    description: 'CPT/HCPCS procedure code',
    dataType: 'string',
    example: '99213, 80053'
  },
  {
    label: 'Service Line - Procedure Modifier 1',
    value: 'serviceLines[*].procedureModifier1',
    category: 'Service Lines',
    description: 'First procedure modifier',
    dataType: 'string',
    example: '25, 59'
  },
  {
    label: 'Service Line - Procedure Modifier 2',
    value: 'serviceLines[*].procedureModifier2',
    category: 'Service Lines',
    description: 'Second procedure modifier',
    dataType: 'string',
    example: 'GT, TC'
  },
  {
    label: 'Service Line - Procedure Modifier 3',
    value: 'serviceLines[*].procedureModifier3',
    category: 'Service Lines',
    description: 'Third procedure modifier',
    dataType: 'string',
    example: 'LT, RT'
  },
  {
    label: 'Service Line - Procedure Modifier 4',
    value: 'serviceLines[*].procedureModifier4',
    category: 'Service Lines',
    description: 'Fourth procedure modifier',
    dataType: 'string',
    example: 'XE, XP'
  },
  {
    label: 'Service Line - Revenue Code',
    value: 'serviceLines[*].revenueCode',
    category: 'Service Lines',
    description: 'Revenue code (Institutional claims only)',
    dataType: 'string',
    example: '0300, 0450'
  },
  {
    label: 'Service Line - Charge Amount',
    value: 'serviceLines[*].lineItemCharge',
    category: 'Service Lines',
    description: 'Charge for this service line',
    dataType: 'number',
    example: '125.00'
  },
  {
    label: 'Service Line - Unit Count',
    value: 'serviceLines[*].serviceUnitCount',
    category: 'Service Lines',
    description: 'Number of units',
    dataType: 'number',
    example: '1, 3'
  },
  {
    label: 'Service Line - Place of Service',
    value: 'serviceLines[*].placeOfService',
    category: 'Service Lines',
    description: 'Line-level place of service',
    dataType: 'string',
    example: '11, 22'
  },
  {
    label: 'Service Line - Service Date From',
    value: 'serviceLines[*].serviceDateFrom',
    category: 'Service Lines',
    description: 'Start date of service',
    dataType: 'date',
    example: '2024-01-15'
  },
  {
    label: 'Service Line - Service Date To',
    value: 'serviceLines[*].serviceDateTo',
    category: 'Service Lines',
    description: 'End date of service',
    dataType: 'date',
    example: '2024-01-15'
  },
  {
    label: 'Service Line - Diagnosis Pointer',
    value: 'serviceLines[*].diagnosisCodePointer',
    category: 'Service Lines',
    description: 'Link to diagnosis codes',
    dataType: 'string',
    example: '1, 1:2'
  },

  // ====================
  // DIAGNOSIS CODES
  // ====================
  {
    label: 'Diagnosis Code - Code',
    value: 'diagnoses[*].code',
    category: 'Diagnoses',
    description: 'ICD-10 diagnosis code',
    dataType: 'string',
    example: 'E11.9, Z79.4'
  },
  {
    label: 'Diagnosis Code - Qualifier',
    value: 'diagnoses[*].codeListQualifier',
    category: 'Diagnoses',
    description: 'Code type (ABK=ICD-10)',
    dataType: 'string',
    example: 'ABK'
  },

  // ====================
  // DATE FIELDS
  // ====================
  {
    label: 'Service Date From (Claim)',
    value: 'serviceDateFrom',
    category: 'Dates',
    description: 'Claim-level service start date',
    dataType: 'date',
    example: '2024-01-01'
  },
  {
    label: 'Service Date To (Claim)',
    value: 'serviceDateTo',
    category: 'Dates',
    description: 'Claim-level service end date',
    dataType: 'date',
    example: '2024-01-31'
  },
  {
    label: 'Statement Date From',
    value: 'statementDateFrom',
    category: 'Dates',
    description: 'Statement period start',
    dataType: 'date',
    example: '2024-01-01'
  },
  {
    label: 'Statement Date To',
    value: 'statementDateTo',
    category: 'Dates',
    description: 'Statement period end',
    dataType: 'date',
    example: '2024-01-31'
  },
  {
    label: 'Admission Date',
    value: 'admissionDate',
    category: 'Dates',
    description: 'Hospital admission date',
    dataType: 'date',
    example: '2024-01-15'
  },
  {
    label: 'Discharge Date',
    value: 'dischargeDate',
    category: 'Dates',
    description: 'Hospital discharge date',
    dataType: 'date',
    example: '2024-01-20'
  },

  // ====================
  // RENDERING PROVIDER
  // ====================
  {
    label: 'Rendering Provider - NPI',
    value: 'renderingProvider.identificationCode',
    category: 'Rendering Provider',
    description: 'Rendering provider NPI',
    dataType: 'string',
    example: '9876543210'
  },
  {
    label: 'Rendering Provider - Last Name',
    value: 'renderingProvider.lastName',
    category: 'Rendering Provider',
    description: 'Rendering provider last name',
    dataType: 'string',
    example: 'Jones'
  },
  {
    label: 'Rendering Provider - First Name',
    value: 'renderingProvider.firstName',
    category: 'Rendering Provider',
    description: 'Rendering provider first name',
    dataType: 'string',
    example: 'Sarah'
  },
  {
    label: 'Rendering Provider - Taxonomy Code',
    value: 'renderingProvider.providerInfo.providerTaxonomyCode',
    category: 'Rendering Provider',
    description: 'Provider specialty taxonomy',
    dataType: 'string',
    example: '207Q00000X'
  },

  // ====================
  // SERVICE FACILITY
  // ====================
  {
    label: 'Service Facility - NPI',
    value: 'serviceFacility.identificationCode',
    category: 'Service Facility',
    description: 'Service facility NPI',
    dataType: 'string',
    example: '1122334455'
  },
  {
    label: 'Service Facility - Name',
    value: 'serviceFacility.lastName',
    category: 'Service Facility',
    description: 'Service facility name',
    dataType: 'string',
    example: 'Memorial Hospital'
  },

  // ====================
  // PAYER INFORMATION
  // ====================
  {
    label: 'Payer - Name',
    value: 'receiver.lastName',
    category: 'Payer',
    description: 'Insurance payer name',
    dataType: 'string',
    example: 'Blue Cross Blue Shield'
  },
  {
    label: 'Payer - Electronic Payer ID',
    value: 'receiver.identificationCode',
    category: 'Payer',
    description: 'Electronic payer ID',
    dataType: 'string',
    example: '12345'
  },
  {
    label: 'Subscriber Relationship Code',
    value: 'subscriberInfo.individualRelationshipCode',
    category: 'Payer',
    description: 'Patient relationship to subscriber (18=Self)',
    dataType: 'string',
    example: '18 (Self), 01 (Spouse)'
  },
  {
    label: 'Group Number',
    value: 'subscriberInfo.groupNumber',
    category: 'Payer',
    description: 'Insurance group number',
    dataType: 'string',
    example: 'GRP12345'
  },

  // ====================
  // REFERENCES
  // ====================
  {
    label: 'Prior Authorization Number',
    value: 'priorAuthNumber',
    category: 'References',
    description: 'Prior authorization reference',
    dataType: 'string',
    example: 'AUTH123456'
  },
];

/**
 * Get field paths grouped by category
 */
export function getFieldPathsByCategory(): Record<string, FieldPathOption[]> {
  const grouped: Record<string, FieldPathOption[]> = {};

  FIELD_PATHS.forEach(path => {
    if (!grouped[path.category]) {
      grouped[path.category] = [];
    }
    grouped[path.category].push(path);
  });

  return grouped;
}

/**
 * Get field path by value
 */
export function getFieldPathByValue(value: string): FieldPathOption | undefined {
  return FIELD_PATHS.find(path => path.value === value);
}

/**
 * Search field paths by keyword
 */
export function searchFieldPaths(query: string): FieldPathOption[] {
  const lowerQuery = query.toLowerCase();
  return FIELD_PATHS.filter(path =>
    path.label.toLowerCase().includes(lowerQuery) ||
    path.value.toLowerCase().includes(lowerQuery) ||
    path.description.toLowerCase().includes(lowerQuery)
  );
}
