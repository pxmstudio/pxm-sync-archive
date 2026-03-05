import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { uploadedFiles, createId } from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Presigned URL request schema
const presignedRequest = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^[\w-]+\/[\w+-]+$/),
  purpose: z.enum(["registration_document", "application_attachment"]),
});

// POST /internal/uploads/presigned - Get upload metadata
app.post("/presigned", zValidator("json", presignedRequest), async (c) => {
  const auth = c.get("auth")!;
  const { filename, contentType, purpose } = c.req.valid("json");

  // Generate unique key
  const fileId = createId("uploadedFile");
  const ext = filename.split(".").pop() || "";
  const key = `${auth.organizationId}/${purpose}/${fileId}${ext ? `.${ext}` : ""}`;

  return success(c, {
    uploadUrl: `/internal/uploads/direct`,
    key,
    fileId,
    contentType,
  });
});

// POST /internal/uploads/direct - Direct file upload
app.post("/direct", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  let key = formData.get("key") as string | null;
  const purpose = formData.get("purpose") as string | null;

  if (!file || !purpose) {
    throw Errors.badRequest("File and purpose are required");
  }

  // Auto-generate key if not provided
  if (!key) {
    const fileId = createId("uploadedFile");
    const ext = file.name.split(".").pop() || "";
    key = `${auth.organizationId}/${purpose}/${fileId}${ext ? `.${ext}` : ""}`;
  }

  // Validate key belongs to this organization
  if (!key.startsWith(`${auth.organizationId}/`)) {
    throw Errors.forbidden("Invalid upload key");
  }

  // Upload to R2
  await c.env.R2_DOCS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      organizationId: auth.organizationId,
      uploadedBy: auth.userId,
      purpose,
      originalFilename: file.name,
    },
  });

  // Store file metadata in database
  const [uploadedFile] = await db
    .insert(uploadedFiles)
    .values({
      organizationId: auth.organizationId,
      key,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      purpose,
      uploadedBy: auth.userId,
    })
    .returning();

  return success(c, {
    id: uploadedFile.id,
    key,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    url: `/internal/uploads/file/${encodeURIComponent(key)}`,
  });
});

// GET /internal/uploads/file/:key - Download file
app.get("/file/*", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  // The path comes in as /internal/uploads/file/... but the route is mounted under /api
  // We need to extract just the key part and decode it
  const rawPath = c.req.path;
  const rawUrl = c.req.url;

  // Extract key from URL - it's everything after /internal/uploads/file/
  const urlObj = new URL(rawUrl);
  const pathParts = urlObj.pathname.split("/internal/uploads/file/");
  const encodedKey = pathParts[1] || "";
  const key = decodeURIComponent(encodedKey);

  console.log("[uploads] Download request - rawPath:", rawPath, "rawUrl:", rawUrl, "encodedKey:", encodedKey, "decodedKey:", key);

  // Get file from R2
  const object = await c.env.R2_DOCS.get(key);
  if (!object) {
    console.log("[uploads] File not found in R2 for key:", key);
    throw Errors.notFound("File");
  }

  // Check access - file belongs to org OR is public
  const metadata = object.customMetadata;
  const fileOrgId = metadata?.organizationId;

  if (fileOrgId !== auth.organizationId) {
    // Check if file exists and is accessible
    const fileRecord = await db.query.uploadedFiles.findFirst({
      where: eq(uploadedFiles.key, key),
    });

    if (!fileRecord || fileRecord.organizationId !== fileOrgId) {
      throw Errors.forbidden("Access denied");
    }

    // Allow access only if file is public
    if (!fileRecord.isPublic) {
      throw Errors.forbidden("Access denied");
    }
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="${metadata?.originalFilename || "download"}"`
  );
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
});

// DELETE /internal/uploads/:id - Delete file
app.delete("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const file = await db.query.uploadedFiles.findFirst({
    where: eq(uploadedFiles.id, id),
  });

  if (!file) {
    throw Errors.notFound("File");
  }

  if (file.organizationId !== auth.organizationId) {
    throw Errors.forbidden("Access denied");
  }

  // Delete from R2
  await c.env.R2_DOCS.delete(file.key);

  // Delete from database
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));

  return success(c, { deleted: true });
});

export default app;
