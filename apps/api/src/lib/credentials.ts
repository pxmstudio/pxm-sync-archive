/**
 * Credentials Encryption Service for Cloudflare Workers
 *
 * Uses GCP KMS REST API directly (not the Node.js client library)
 * because Cloudflare Workers don't support the Node.js KMS client.
 */

import type { Env } from "../types.js";

// Current encryption schema version
const ENCRYPTION_VERSION = 1;

export interface CredentialsContext {
  /** Organization ID that owns the credentials */
  organizationId: string;
  /** Integration ID these credentials belong to */
  integrationId?: string;
  /** Resource type for additional context */
  resourceType: "shopify" | "custom_supplier" | "webhook";
}

interface EncryptionContext {
  [key: string]: string;
}

interface EncryptedReference {
  version: number;
  ciphertext: string;
  keyId?: string;
  context?: EncryptionContext;
  encryptedAt: string;
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/**
 * Create a JWT for GCP authentication using Web Crypto API
 */
async function createGCPAuthToken(
  credentials: ServiceAccountCredentials
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiry

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: "https://cloudkms.googleapis.com/",
    iat: now,
    exp: exp,
  };

  // Base64URL encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key for signing
  const privateKeyPem = credentials.private_key;
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the input
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signatureInput}.${signature}`;
}

/**
 * Serialize encryption context to a deterministic string for AAD
 */
function serializeContext(context: EncryptionContext): string {
  const sortedKeys = Object.keys(context).sort();
  const pairs = sortedKeys.map((key) => `${key}=${context[key]}`);
  return pairs.join("&");
}

/**
 * Encrypt using GCP KMS REST API
 */
async function kmsEncrypt(
  env: Env,
  credentials: ServiceAccountCredentials,
  plaintext: string,
  context?: EncryptionContext
): Promise<{ ciphertext: string; keyVersion?: string }> {
  const keyName = `projects/${env.GCP_KMS_PROJECT_ID}/locations/${env.GCP_KMS_LOCATION}/keyRings/${env.GCP_KMS_KEY_RING}/cryptoKeys/${env.GCP_KMS_KEY}`;
  const url = `https://cloudkms.googleapis.com/v1/${keyName}:encrypt`;

  const token = await createGCPAuthToken(credentials);

  const body: Record<string, string> = {
    plaintext: btoa(plaintext),
  };

  if (context) {
    body.additionalAuthenticatedData = btoa(serializeContext(context));
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`KMS encrypt failed: ${error}`);
  }

  const data = (await response.json()) as { ciphertext: string; name?: string };

  return {
    ciphertext: data.ciphertext,
    keyVersion: data.name,
  };
}

/**
 * Decrypt using GCP KMS REST API
 */
async function kmsDecrypt(
  env: Env,
  credentials: ServiceAccountCredentials,
  ciphertext: string,
  context?: EncryptionContext
): Promise<string> {
  const keyName = `projects/${env.GCP_KMS_PROJECT_ID}/locations/${env.GCP_KMS_LOCATION}/keyRings/${env.GCP_KMS_KEY_RING}/cryptoKeys/${env.GCP_KMS_KEY}`;
  const url = `https://cloudkms.googleapis.com/v1/${keyName}:decrypt`;

  const token = await createGCPAuthToken(credentials);

  const body: Record<string, string> = {
    ciphertext: ciphertext,
  };

  if (context) {
    body.additionalAuthenticatedData = btoa(serializeContext(context));
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`KMS decrypt failed: ${error}`);
  }

  const data = (await response.json()) as { plaintext: string };

  return atob(data.plaintext);
}

/**
 * Parse service account credentials from environment
 */
function getServiceAccountCredentials(env: Env): ServiceAccountCredentials {
  return JSON.parse(atob(env.GCP_SERVICE_ACCOUNT_JSON)) as ServiceAccountCredentials;
}

/**
 * Encrypt credentials and return a serialized reference for database storage
 */
export async function encryptCredentials(
  env: Env,
  credentials: Record<string, unknown>,
  context: CredentialsContext
): Promise<string> {
  const serviceAccount = getServiceAccountCredentials(env);

  // Build encryption context for AAD (Additional Authenticated Data)
  const encryptionContext: EncryptionContext = {
    org: context.organizationId,
    type: context.resourceType,
    ...(context.integrationId && { integration: context.integrationId }),
  };

  // Encrypt the credentials JSON
  const plaintext = JSON.stringify(credentials);
  const result = await kmsEncrypt(env, serviceAccount, plaintext, encryptionContext);

  // Build the encrypted reference
  const ref: EncryptedReference = {
    version: ENCRYPTION_VERSION,
    ciphertext: result.ciphertext,
    keyId: result.keyVersion,
    context: encryptionContext,
    encryptedAt: new Date().toISOString(),
  };

  return JSON.stringify(ref);
}

/**
 * Decrypt credentials from a serialized reference
 */
export async function decryptCredentials<T = Record<string, unknown>>(
  env: Env,
  encryptedRef: string
): Promise<T> {
  const serviceAccount = getServiceAccountCredentials(env);

  // Deserialize the reference
  const ref = JSON.parse(encryptedRef) as EncryptedReference;

  // Decrypt using the stored context
  const plaintext = await kmsDecrypt(env, serviceAccount, ref.ciphertext, ref.context);

  // Parse and return the credentials
  return JSON.parse(plaintext) as T;
}

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
 * Get credentials, handling both encrypted and legacy plain formats
 * This allows gradual migration from plain to encrypted credentials
 */
export async function getCredentials<T = Record<string, unknown>>(
  env: Env,
  credentialsRef: string | null
): Promise<T | null> {
  if (!credentialsRef) {
    return null;
  }

  // Check if this is an encrypted reference
  if (isEncryptedRef(credentialsRef)) {
    return decryptCredentials<T>(env, credentialsRef);
  }

  // Legacy: plain JSON credentials (should be migrated)
  try {
    return JSON.parse(credentialsRef) as T;
  } catch {
    return null;
  }
}
