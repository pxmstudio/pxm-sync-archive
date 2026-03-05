/**
 * GCP KMS Adapter
 *
 * Implementation of KMSAdapter using Google Cloud Key Management Service.
 */

import { KeyManagementServiceClient } from "@google-cloud/kms";
import type {
  KMSAdapter,
  EncryptionContext,
  EncryptResult,
  DecryptResult,
} from "./types.js";

export interface GCPKMSAdapterConfig {
  /** GCP project ID */
  projectId: string;

  /** KMS location (e.g., "us-central1", "global") */
  locationId: string;

  /** KMS key ring ID */
  keyRingId: string;

  /** KMS crypto key ID */
  keyId: string;

  /**
   * Optional: Path to service account key file.
   * If not provided, uses Application Default Credentials (ADC).
   */
  keyFilePath?: string;

  /**
   * Optional: Service account credentials as JSON object.
   * Alternative to keyFilePath for environments where files aren't available.
   */
  credentials?: {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
}

export class GCPKMSAdapter implements KMSAdapter {
  private client: KeyManagementServiceClient;
  private keyName: string;
  private config: GCPKMSAdapterConfig;

  constructor(config: GCPKMSAdapterConfig) {
    this.config = config;

    // Build the full key name
    this.keyName = `projects/${config.projectId}/locations/${config.locationId}/keyRings/${config.keyRingId}/cryptoKeys/${config.keyId}`;

    // Initialize the client
    if (config.credentials) {
      this.client = new KeyManagementServiceClient({
        credentials: config.credentials,
        projectId: config.projectId,
      });
    } else if (config.keyFilePath) {
      this.client = new KeyManagementServiceClient({
        keyFilename: config.keyFilePath,
        projectId: config.projectId,
      });
    } else {
      // Use Application Default Credentials
      this.client = new KeyManagementServiceClient({
        projectId: config.projectId,
      });
    }
  }

  async encrypt(
    plaintext: string,
    context?: EncryptionContext
  ): Promise<EncryptResult> {
    const plaintextBuffer = Buffer.from(plaintext, "utf8");

    // Build additional authenticated data from context
    const additionalAuthenticatedData = context
      ? Buffer.from(this.serializeContext(context), "utf8")
      : undefined;

    const [response] = await this.client.encrypt({
      name: this.keyName,
      plaintext: plaintextBuffer,
      additionalAuthenticatedData,
    });

    if (!response.ciphertext) {
      throw new Error("Encryption failed: no ciphertext returned");
    }

    // Convert ciphertext to base64
    const ciphertextBase64 =
      typeof response.ciphertext === "string"
        ? response.ciphertext
        : Buffer.from(response.ciphertext).toString("base64");

    return {
      ciphertext: ciphertextBase64,
      keyVersion: response.name || undefined,
    };
  }

  async decrypt(
    ciphertext: string,
    context?: EncryptionContext
  ): Promise<DecryptResult> {
    // Decode base64 ciphertext
    const ciphertextBuffer = Buffer.from(ciphertext, "base64");

    // Build additional authenticated data from context
    const additionalAuthenticatedData = context
      ? Buffer.from(this.serializeContext(context), "utf8")
      : undefined;

    const [response] = await this.client.decrypt({
      name: this.keyName,
      ciphertext: ciphertextBuffer,
      additionalAuthenticatedData,
    });

    if (!response.plaintext) {
      throw new Error("Decryption failed: no plaintext returned");
    }

    // Convert plaintext buffer to string
    const plaintextString =
      typeof response.plaintext === "string"
        ? response.plaintext
        : Buffer.from(response.plaintext).toString("utf8");

    return {
      plaintext: plaintextString,
    };
  }

  async generateRandomBytes(length: number): Promise<string> {
    const locationName = `projects/${this.config.projectId}/locations/${this.config.locationId}`;

    const [response] = await this.client.generateRandomBytes({
      location: locationName,
      lengthBytes: length,
      protectionLevel: "HSM", // Use Hardware Security Module for true randomness
    });

    if (!response.data) {
      throw new Error("Failed to generate random bytes");
    }

    // Convert to hex string
    const dataBuffer =
      typeof response.data === "string"
        ? Buffer.from(response.data, "base64")
        : Buffer.from(response.data);

    return dataBuffer.toString("hex");
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      // Try to get the crypto key to verify access
      const [key] = await this.client.getCryptoKey({
        name: this.keyName,
      });

      if (!key) {
        return {
          success: false,
          message: "Key not found",
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Serialize encryption context to a deterministic string.
   * Keys are sorted to ensure consistent AAD regardless of object property order.
   */
  private serializeContext(context: EncryptionContext): string {
    const sortedKeys = Object.keys(context).sort();
    const pairs = sortedKeys.map((key) => `${key}=${context[key]}`);
    return pairs.join("&");
  }

  /**
   * Get the full key name (useful for debugging)
   */
  getKeyName(): string {
    return this.keyName;
  }
}

/**
 * Factory function for creating GCP KMS adapter from environment variables
 *
 * Supports two authentication methods:
 * - GCP_SERVICE_ACCOUNT_JSON: Base64-encoded service account JSON
 * - GCP_KMS_KEY_FILE: Path to service account JSON file (fallback)
 */
export function createGCPKMSAdapterFromEnv(): GCPKMSAdapter {
  const projectId = process.env.GCP_KMS_PROJECT_ID;
  const locationId = process.env.GCP_KMS_LOCATION;
  const keyRingId = process.env.GCP_KMS_KEY_RING;
  const keyId = process.env.GCP_KMS_KEY;

  if (!projectId || !locationId || !keyRingId || !keyId) {
    throw new Error(
      "Missing required GCP KMS environment variables: " +
        "GCP_KMS_PROJECT_ID, GCP_KMS_LOCATION, GCP_KMS_KEY_RING, GCP_KMS_KEY"
    );
  }

  // Check for base64-encoded service account JSON first
  const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const credentials = JSON.parse(
      Buffer.from(serviceAccountJson, "base64").toString("utf8")
    ) as {
      client_email: string;
      private_key: string;
      project_id?: string;
    };

    return new GCPKMSAdapter({
      projectId,
      locationId,
      keyRingId,
      keyId,
      credentials,
    });
  }

  // Fall back to key file path
  return new GCPKMSAdapter({
    projectId,
    locationId,
    keyRingId,
    keyId,
    keyFilePath: process.env.GCP_KMS_KEY_FILE,
  });
}
