import pg from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "10.1.9.161",
  database: process.env.DB_NAME || "Claim837",
  password: process.env.DB_PASSWORD || "hlnotes",
  port: parseInt(process.env.DB_PORT) || 5434,
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log("🌱 Starting database seeding...");

    // Hash password for default users
    const passwordHash = await bcrypt.hash("Admin@123", 10);

    // 1. Create default roles
    console.log("\n📝 Creating roles...");
    const adminRoleResult = await client.query(`
      INSERT INTO UserRole (role_name, description, permissions)
      VALUES
        ('Admin', 'System Administrator with full access',
         '{"claims": ["create", "read", "update", "delete"], "users": ["create", "read", "update", "delete"], "rules": ["create", "read", "update", "delete"], "reports": ["read", "export"]}'::jsonb),
        ('Analyst', 'Claim Analyst for corrections and review',
         '{"claims": ["read", "update"], "corrections": ["create", "approve"], "reports": ["read"]}'::jsonb),
        ('Viewer', 'Read-only access to claims and reports',
         '{"claims": ["read"], "reports": ["read"]}'::jsonb)
      ON CONFLICT (role_name) DO NOTHING
      RETURNING role_id, role_name
    `);
    console.log(`✅ Created ${adminRoleResult.rowCount} roles`);

    // 2. Create default admin user
    console.log("\n👤 Creating default admin user...");
    const adminUserResult = await client.query(
      `
      INSERT INTO Users (username, email, password_hash, first_name, last_name, is_active)
      VALUES ('admin', 'admin@claim837.com', $1, 'System', 'Administrator', true)
      ON CONFLICT (username) DO NOTHING
      RETURNING user_id, username
    `,
      [passwordHash]
    );

    if (adminUserResult.rowCount > 0) {
      const adminUserId = adminUserResult.rows[0].user_id;
      const adminRoleId = adminRoleResult.rows[0].role_id;

      // Assign admin role
      await client.query(
        `
        INSERT INTO UserRoleMapping (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
        [adminUserId, adminRoleId]
      );

      console.log("✅ Admin user created: admin / Admin@123");
    }

    // 3. Create sample facilities
    console.log("\n🏥 Creating sample facilities...");
    const facilitiesResult = await client.query(`
      INSERT INTO Facilities (facility_code, facility_name, npi, tax_id, address_line1, city, state, zip_code, phone, facility_type, is_active)
      VALUES
        ('FAC001', 'City General Hospital', '1234567890', '12-3456789', '123 Main St', 'New York', 'NY', '10001', '212-555-0100', 'Hospital', true),
        ('FAC002', 'Downtown Medical Center', '0987654321', '98-7654321', '456 Oak Ave', 'Los Angeles', 'CA', '90001', '213-555-0200', 'Medical Center', true),
        ('FAC003', 'Suburban Clinic', '1122334455', '11-2233445', '789 Elm St', 'Chicago', 'IL', '60601', '312-555-0300', 'Clinic', true)
      ON CONFLICT (facility_code) DO NOTHING
      RETURNING facility_id, facility_name
    `);
    console.log(`✅ Created ${facilitiesResult.rowCount} facilities`);

    // 4. Create sample providers
    console.log("\n👨‍⚕️ Creating sample providers...");
    const providersResult = await client.query(`
      INSERT INTO Provider (npi, first_name, last_name, taxonomy_code, specialty, license_number, license_state, phone, is_active)
      VALUES
        ('1234567893', 'John', 'Smith', '207R00000X', 'Internal Medicine', 'MD123456', 'NY', '212-555-1000', true),
        ('1234567894', 'Sarah', 'Johnson', '208600000X', 'Surgery', 'MD789012', 'CA', '213-555-2000', true),
        ('1234567895', 'Michael', 'Brown', '207Q00000X', 'Family Medicine', 'MD345678', 'IL', '312-555-3000', true)
      ON CONFLICT (npi) DO NOTHING
      RETURNING provider_id, first_name, last_name
    `);
    console.log(`✅ Created ${providersResult.rowCount} providers`);

    // 5. Create sample payers
    console.log("\n💼 Creating sample payers...");
    const payersResult = await client.query(`
      INSERT INTO Payer (payer_code, payer_name, payer_type, electronic_payer_id, transmission_method, is_active)
      VALUES
        ('PAY001', 'Medicare', 'Medicare', '00123', 'SFTP', true),
        ('PAY002', 'Blue Cross Blue Shield', 'Commercial', '00456', 'API', true),
        ('PAY003', 'Medicaid', 'Medicaid', '00789', 'SFTP', true),
        ('PAY004', 'United Healthcare', 'Commercial', '00321', 'API', true)
      ON CONFLICT (payer_code) DO NOTHING
      RETURNING payer_id, payer_name
    `);
    console.log(`✅ Created ${payersResult.rowCount} payers`);

    // 6. Create sample validation rules
    console.log("\n📋 Creating validation rules...");
    const rulesResult = await client.query(`
      INSERT INTO ValidationRules (rule_code, rule_name, rule_category, rule_type, description, field_name, validation_logic, error_message_template, severity, is_active, priority)
      VALUES
        ('VR001', 'NPI Required', 'BUSINESS', 'REQUIRED_FIELD', 'Provider NPI is required', 'provider_npi', '{"required": true}'::jsonb, 'Provider NPI is missing', 'ERROR', true, 100),
        ('VR002', 'Valid NPI Format', 'BUSINESS', 'FORMAT', 'NPI must be 10 digits', 'provider_npi', '{"pattern": "^[0-9]{10}$"}'::jsonb, 'Invalid NPI format. Must be 10 digits', 'ERROR', true, 90),
        ('VR003', 'Service Date Required', 'BUSINESS', 'REQUIRED_FIELD', 'Service date is required', 'service_date', '{"required": true}'::jsonb, 'Service date is missing', 'ERROR', true, 100),
        ('VR004', 'Service Date Range', 'BUSINESS', 'RANGE', 'Service date must be within valid range', 'service_date', '{"min": "1900-01-01", "max": "today+30"}'::jsonb, 'Service date is out of valid range', 'ERROR', true, 80),
        ('VR005', 'Diagnosis Code Required', 'BUSINESS', 'REQUIRED_FIELD', 'At least one diagnosis code is required', 'diagnosis_codes', '{"minLength": 1}'::jsonb, 'At least one diagnosis code must be provided', 'ERROR', true, 100),
        ('VR006', 'Valid ICD-10 Format', 'BUSINESS', 'FORMAT', 'Diagnosis code must be valid ICD-10 format', 'diagnosis_code', '{"pattern": "^[A-Z][0-9]{2}(\\\\.[0-9]{1,4})?$"}'::jsonb, 'Invalid ICD-10 code format', 'ERROR', true, 90),
        ('VR007', 'Procedure Code Required', 'BUSINESS', 'REQUIRED_FIELD', 'Procedure code is required for each service line', 'procedure_code', '{"required": true}'::jsonb, 'Procedure code is missing', 'ERROR', true, 100),
        ('VR008', 'Valid CPT Format', 'BUSINESS', 'FORMAT', 'Procedure code must be valid CPT format', 'procedure_code', '{"pattern": "^[0-9]{5}$"}'::jsonb, 'Invalid CPT code format. Must be 5 digits', 'ERROR', true, 90),
        ('VR009', 'Payer ID Required', 'BUSINESS', 'REQUIRED_FIELD', 'Payer ID is required', 'payer_id', '{"required": true}'::jsonb, 'Payer ID is missing', 'ERROR', true, 100),
        ('VR010', 'Place of Service Required', 'BUSINESS', 'REQUIRED_FIELD', 'Place of service code is required', 'place_of_service', '{"required": true}'::jsonb, 'Place of service code is missing', 'WARNING', true, 70)
      ON CONFLICT (rule_code) DO NOTHING
      RETURNING rule_id, rule_code
    `);
    console.log(`✅ Created ${rulesResult.rowCount} validation rules`);

    // 7. Create sample correction rules
    console.log("\n🔧 Creating correction rules...");
    const correctionRulesResult = await client.query(`
      INSERT INTO CorrectionRules (rule_code, rule_name, correction_type, correction_logic, is_active, priority)
      VALUES
        ('CR001', 'Auto-fill Provider NPI', 'LOOKUP', '{"table": "Provider", "match_field": "provider_name", "return_field": "npi"}'::jsonb, true, 100),
        ('CR002', 'Auto-fill Payer ID', 'LOOKUP', '{"table": "Payer", "match_field": "payer_name", "return_field": "payer_code"}'::jsonb, true, 100),
        ('CR003', 'Default Place of Service', 'DEFAULT_VALUE', '{"default": "11"}'::jsonb, true, 80),
        ('CR004', 'Standardize Date Format', 'CALCULATION', '{"function": "formatDate", "format": "YYYY-MM-DD"}'::jsonb, true, 90),
        ('CR005', 'AI-Assisted Diagnosis Code', 'AI_ASSISTED', '{"model": "azure-openai", "prompt_template": "Suggest appropriate ICD-10 code"}'::jsonb, true, 50)
      ON CONFLICT (rule_code) DO NOTHING
      RETURNING rule_id, rule_code
    `);
    console.log(
      `✅ Created ${correctionRulesResult.rowCount} correction rules`
    );

    console.log("\n✨ Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Roles: ${adminRoleResult.rowCount}`);
    console.log(`   Users: 1 (admin / Admin@123)`);
    console.log(`   Facilities: ${facilitiesResult.rowCount}`);
    console.log(`   Providers: ${providersResult.rowCount}`);
    console.log(`   Payers: ${payersResult.rowCount}`);
    console.log(`   Validation Rules: ${rulesResult.rowCount}`);
    console.log(`   Correction Rules: ${correctionRulesResult.rowCount}`);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
