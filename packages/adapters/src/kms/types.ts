/**
 * KMS Adapter Types
 *
 * Abstraction layer for Key Management Services (GCP KMS, AWS KMS, etc.)
 * This allows encrypting/decrypting sensitive data like API credentials.
 */

export interface EncryptionContext {
  /**
   * Additional authenticated data (AAD) for encryption context.
   * This adds an extra layer of security by binding the ciphertext
   * to a specific context (e.g., organization ID, resource type).
   */
  [key: string]: string;
}

export interface EncryptResult {
  /** Base64-encoded ciphertext */
  ciphertext: string;

  /** Key version used for encryption (for key rotation tracking) */
  keyVersion?: string;
}

export interface DecryptResult {
  /** Decrypted plaintext */
  plaintext: string;
}

export interface KMSAdapter {
  /**
   * Encrypt plaintext data
   * @param plaintext - The data to encrypt
   * @param context - Optional encryption context for additional authentication
   * @returns The encrypted ciphertext
   */
  encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptResult>;

  /**
   * Decrypt ciphertext
   * @param ciphertext - The data to decrypt (base64-encoded)
   * @param context - Must match the context used during encryption
   * @returns The decrypted plaintext
   */
  decrypt(ciphertext: string, context?: EncryptionContext): Promise<DecryptResult>;

  /**
   * Generate a random string (useful for secrets, API keys, etc.)
   * @param length - Length of the random string in bytes
   * @returns Random bytes as hex string
   */
  generateRandomBytes(length: number): Promise<string>;

  /**
   * Test the connection to the KMS service
   * @returns Whether the connection is successful
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;
}

/**
 * Helper type for storing encrypted references in the database.
 * The reference includes metadata about how the data was encrypted.
 */
export interface EncryptedReference {
  /** Version of the encryption scheme */
  version: number;

  /** The encrypted ciphertext */
  ciphertext: string;

  /** Key identifier (for key rotation) */
  keyId?: string;

  /** Encryption context used */
  context?: EncryptionContext;

  /** Timestamp when encrypted */
  encryptedAt: string;
}

/**
 * Serialize an encrypted reference to a string for database storage
 */
export function serializeEncryptedRef(ref: EncryptedReference): string {
  return JSON.stringify(ref);
}

/**
 * Deserialize an encrypted reference from database storage
 */
export function deserializeEncryptedRef(data: string): EncryptedReference {
  return JSON.parse(data) as EncryptedReference;
}
