/**
 * Credentials Decryption for Trigger Tasks
 *
 * Uses GCP KMS to decrypt sensitive credentials like API tokens.
 * Uses process.env for configuration (as opposed to Cloudflare Workers env).
 */

import {
  createGCPKMSAdapterFromEnv,
  deserializeEncryptedRef,
} from "@workspace/adapters/kms";

/**
 * Check if a credentials reference is encrypted (vs legacy plain JSON)
 */
export function isEncryptedRef(credentialsRef: string): boolean {
  try {
    const parsed = JSON.parse(credentialsRef);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "ciphertext" in parsed &&
      "encryptedAt" in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Decrypt credentials from a serialized reference
 */
export async function decryptCredentials<T = Record<string, unknown>>(
  encryptedRef: string
): Promise<T> {
  const kms = createGCPKMSAdapterFromEnv();

  // Deserialize the reference
  const ref = deserializeEncryptedRef(encryptedRef);

  // Decrypt using the stored context
  const result = await kms.decrypt(ref.ciphertext, ref.context);

  // Parse and return the credentials
  return JSON.parse(result.plaintext) as T;
}

/**
 * Get credentials, handling both encrypted and legacy plain formats.
 * This allows gradual migration from plain to encrypted credentials.
 */
export async function getCredentials<T = Record<string, unknown>>(
  credentialsRef: string | null
): Promise<T | null> {
  if (!credentialsRef) {
    return null;
  }

  // Check if this is an encrypted reference
  if (isEncryptedRef(credentialsRef)) {
    return decryptCredentials<T>(credentialsRef);
  }

  // Legacy: plain JSON credentials (should be migrated)
  try {
    return JSON.parse(credentialsRef) as T;
  } catch {
    return null;
  }
}

/**
 * Get Shopify access token from integration credentials
 */
export async function getShopifyAccessToken(
  integration: { credentialsRef: string | null }
): Promise<string> {
  if (!integration.credentialsRef) {
    throw new Error("Integration missing credentials");
  }

  const creds = await getCredentials<{ accessToken: string }>(
    integration.credentialsRef
  );

  if (!creds?.accessToken) {
    throw new Error("Integration credentials missing access token");
  }

  return creds.accessToken;
}
