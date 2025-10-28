import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

/**
 * Encryption Utility
 * Handles password encryption/decryption for SFTP credentials
 * Uses AES-256-CBC encryption
 */

// Algorithm configuration
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Get encryption key from environment
 * @returns {Buffer} Encryption key
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY not found in environment variables. Please set it in .env file."
    );
  }

  // If key is hex-encoded (64 characters for 32 bytes)
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }

  // If key is a plain string, hash it to get 32 bytes
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a password
 * @param {string} plaintext - Password to encrypt
 * @returns {string} Encrypted password (hex-encoded: IV + encrypted data)
 */
export function encryptPassword(plaintext) {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty password");
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV + encrypted data (both hex-encoded)
    return iv.toString("hex") + encrypted;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a password
 * @param {string} encryptedPassword - Encrypted password (hex-encoded)
 * @returns {string} Decrypted password
 */
export function decryptPassword(encryptedPassword) {
  if (!encryptedPassword) {
    throw new Error("Cannot decrypt empty password");
  }

  try {
    const key = getEncryptionKey();

    // Extract IV (first 32 hex characters = 16 bytes)
    const iv = Buffer.from(encryptedPassword.slice(0, 32), "hex");
    const encrypted = encryptedPassword.slice(32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generate a new encryption key
 * Use this to generate a key for ENCRYPTION_KEY environment variable
 * @returns {string} 64-character hex string (32 bytes)
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate that encryption is working correctly
 * @returns {boolean} True if encryption/decryption works
 */
export function testEncryption() {
  try {
    const testPassword = "test_password_123!@#";
    const encrypted = encryptPassword(testPassword);
    const decrypted = decryptPassword(encrypted);

    return decrypted === testPassword;
  } catch (error) {
    console.error("Encryption test failed:", error.message);
    return false;
  }
}

// Export all functions
export default {
  encryptPassword,
  decryptPassword,
  generateEncryptionKey,
  testEncryption,
};
