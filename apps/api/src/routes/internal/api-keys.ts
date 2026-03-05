import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, isNull } from "drizzle-orm";
import { apiKeys } from "@workspace/db";
import { createApiKey, updateApiKey } from "@workspace/validators/api-keys";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Generate API key
function generateApiKey(): { key: string; prefix: string } {
  const random = crypto.randomUUID().replace(/-/g, "");
  const key = `pxm_live_${random}`;
  const prefix = key.substring(0, 16);
  return { key, prefix };
}

// Hash API key for storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// GET /internal/api-keys - List API keys (retailer only)
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const keys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.organizationId, auth.organizationId),
      isNull(apiKeys.revokedAt)
    ),
    columns: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return success(c, keys);
});

// POST /internal/api-keys - Create API key (retailer only)
app.post("/", zValidator("json", createApiKey), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const data = c.req.valid("json");

  // Generate key
  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      organizationId: auth.organizationId,
      name: data.name,
      prefix,
      keyHash,
      scopes: data.scopes,
      expiresAt: data.expiresAt,
    })
    .returning();

  // Return full key (only shown once)
  return success(
    c,
    {
      id: apiKey!.id,
      name: apiKey!.name,
      prefix: apiKey!.prefix,
      key, // Full key - only returned on creation!
      scopes: apiKey!.scopes,
      expiresAt: apiKey!.expiresAt,
      createdAt: apiKey!.createdAt,
    },
    201
  );
});

// PATCH /internal/api-keys/:id - Update API key
app.patch("/:id", zValidator("json", updateApiKey), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, id),
      eq(apiKeys.organizationId, auth.organizationId),
      isNull(apiKeys.revokedAt)
    ),
  });

  if (!apiKey) {
    throw Errors.notFound("API key");
  }

  const [updated] = await db
    .update(apiKeys)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.scopes && { scopes: data.scopes }),
    })
    .where(eq(apiKeys.id, id))
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

  return success(c, updated);
});

// DELETE /internal/api-keys/:id - Revoke API key
app.delete("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, id),
      eq(apiKeys.organizationId, auth.organizationId),
      isNull(apiKeys.revokedAt)
    ),
  });

  if (!apiKey) {
    throw Errors.notFound("API key");
  }

  await db
    .update(apiKeys)
    .set({
      revokedAt: new Date(),
    })
    .where(eq(apiKeys.id, id));

  return c.body(null, 204);
});

export default app;
