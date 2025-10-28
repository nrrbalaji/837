import { Parser } from 'json2csv';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSV Import/Export Utilities for Master Data
 */

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/csv'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * Export data to CSV
 * @param {Array} data - Array of objects to export
 * @param {Array} fields - Array of field configurations
 * @returns {string} CSV string
 */
export function exportToCSV(data, fields) {
  try {
    const parser = new Parser({ fields });
    return parser.parse(data);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Failed to export data to CSV');
  }
}

/**
 * Parse CSV file to JSON
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of parsed objects
 */
export async function parseCSV(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Parse rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return data;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error('Failed to parse CSV file');
  }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Validate CSV data against schema
 * @param {Array} data - Parsed CSV data
 * @param {Object} schema - Validation schema
 * @returns {Object} { valid: boolean, errors: Array, validRecords: Array }
 */
export function validateCSVData(data, schema) {
  const errors = [];
  const validRecords = [];

  data.forEach((row, index) => {
    const rowErrors = [];

    // Check required fields
    if (schema.required) {
      schema.required.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          rowErrors.push(`Row ${index + 2}: Missing required field '${field}'`);
        }
      });
    }

    // Validate field formats
    if (schema.validators) {
      Object.keys(schema.validators).forEach(field => {
        const validator = schema.validators[field];
        const value = row[field];

        if (value && validator.pattern && !validator.pattern.test(value)) {
          rowErrors.push(`Row ${index + 2}: Invalid format for '${field}' - ${validator.message}`);
        }

        if (value && validator.maxLength && value.length > validator.maxLength) {
          rowErrors.push(`Row ${index + 2}: '${field}' exceeds maximum length of ${validator.maxLength}`);
        }

        if (validator.enum && value && !validator.enum.includes(value)) {
          rowErrors.push(`Row ${index + 2}: '${field}' must be one of: ${validator.enum.join(', ')}`);
        }
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRecords.push(row);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validRecords,
    totalRecords: data.length,
    validCount: validRecords.length,
    errorCount: data.length - validRecords.length
  };
}

/**
 * Provider Master CSV Schema
 */
export const providerSchema = {
  required: ['provider_name', 'npi', 'tax_id'],
  validators: {
    npi: {
      pattern: /^\d{10}$/,
      message: 'NPI must be exactly 10 digits'
    },
    contact_email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Invalid email format'
    },
    state: {
      pattern: /^[A-Z]{2}$/,
      message: 'State must be 2-letter code'
    },
    status: {
      enum: ['Active', 'Inactive', 'Pending'],
      message: 'Status must be Active, Inactive, or Pending'
    }
  }
};

/**
 * Payer Master CSV Schema
 */
export const payerSchema = {
  required: ['payer_code', 'payer_name'],
  validators: {
    payer_type: {
      enum: ['Medicare', 'Medicaid', 'Commercial', 'Other'],
      message: 'Invalid payer type'
    },
    transmission_method: {
      enum: ['SFTP', 'API', 'HL7', 'FHIR'],
      message: 'Invalid transmission method'
    },
    state: {
      pattern: /^[A-Z]{2}$/,
      message: 'State must be 2-letter code'
    }
  }
};

/**
 * Facility Master CSV Schema
 */
export const facilitySchema = {
  required: ['facility_code', 'facility_name'],
  validators: {
    npi: {
      pattern: /^\d{10}$/,
      message: 'NPI must be exactly 10 digits'
    },
    state: {
      pattern: /^[A-Z]{2}$/,
      message: 'State must be 2-letter code'
    }
  }
};

/**
 * Trading Partner Master CSV Schema
 */
export const tradingPartnerSchema = {
  required: ['trading_partner_id', 'partner_name', 'partner_type'],
  validators: {
    partner_type: {
      enum: ['Sender', 'Receiver', 'Both'],
      message: 'Partner type must be Sender, Receiver, or Both'
    },
    direction: {
      enum: ['Inbound', 'Outbound', 'Bidirectional'],
      message: 'Direction must be Inbound, Outbound, or Bidirectional'
    },
    channel_type: {
      enum: ['SFTP', 'API', 'HL7', 'FHIR'],
      message: 'Invalid channel type'
    },
    status: {
      enum: ['Active', 'Inactive', 'Testing'],
      message: 'Status must be Active, Inactive, or Testing'
    }
  }
};

/**
 * Clean up uploaded file
 */
export async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
}

/**
 * Export field configurations for each master type
 */
export const exportFields = {
  provider: [
    { label: 'Provider Name', value: 'provider_name' },
    { label: 'NPI', value: 'npi' },
    { label: 'Tax ID', value: 'tax_id' },
    { label: 'Specialty', value: 'facility_type' },
    { label: 'Taxonomy Code', value: 'taxonomy_code' },
    { label: 'Address', value: 'address' },
    { label: 'City', value: 'city' },
    { label: 'State', value: 'state' },
    { label: 'ZIP', value: 'zip' },
    { label: 'Contact Email', value: 'contact_email' },
    { label: 'Contact Phone', value: 'contact_phone' },
    { label: 'Status', value: 'status' }
  ],
  payer: [
    { label: 'Payer Code', value: 'payer_code' },
    { label: 'Payer Name', value: 'payer_name' },
    { label: 'Payer Type', value: 'payer_type' },
    { label: 'Electronic Payer ID', value: 'electronic_payer_id' },
    { label: 'City', value: 'city' },
    { label: 'State', value: 'state' },
    { label: 'Transmission Method', value: 'transmission_method' },
    { label: 'Endpoint URL', value: 'endpoint_url' },
    { label: 'Status', value: 'status' }
  ],
  facility: [
    { label: 'Facility Code', value: 'facility_code' },
    { label: 'Facility Name', value: 'facility_name' },
    { label: 'NPI', value: 'npi' },
    { label: 'Tax ID', value: 'tax_id' },
    { label: 'Facility Type', value: 'facility_type' },
    { label: 'Address', value: 'address_line1' },
    { label: 'City', value: 'city' },
    { label: 'State', value: 'state' },
    { label: 'ZIP', value: 'zip_code' },
    { label: 'Phone', value: 'phone' },
    { label: 'Status', value: 'status' }
  ],
  tradingPartner: [
    { label: 'Trading Partner ID', value: 'trading_partner_id' },
    { label: 'Partner Name', value: 'partner_name' },
    { label: 'Partner Type', value: 'partner_type' },
    { label: 'Sender Qualifier', value: 'sender_qualifier' },
    { label: 'Sender ID', value: 'sender_id' },
    { label: 'Receiver Qualifier', value: 'receiver_qualifier' },
    { label: 'Receiver ID', value: 'receiver_id' },
    { label: 'Direction', value: 'direction' },
    { label: 'Channel Type', value: 'channel_type' },
    { label: 'Endpoint URL', value: 'endpoint_url' },
    { label: 'Status', value: 'status' }
  ]
};

export default {
  uploadMiddleware,
  exportToCSV,
  parseCSV,
  validateCSVData,
  cleanupFile,
  providerSchema,
  payerSchema,
  facilitySchema,
  tradingPartnerSchema,
  exportFields
};
