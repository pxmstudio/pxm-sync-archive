import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { organizationAddresses } from "@workspace/db";
import { z } from "zod";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Validation schemas
const addressTypeSchema = z.enum([
  "billing",
  "shipping",
  "warehouse",
  "store",
  "headquarters",
  "fulfillment_center",
  "return",
]);

const createAddressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  type: addressTypeSchema,
  isDefault: z.boolean().optional().default(false),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().length(2, "Country must be a 2-letter ISO code"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

const updateAddressSchema = createAddressSchema.partial();

// GET /internal/addresses - List organization's addresses
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const type = c.req.query("type") as typeof addressTypeSchema._type | undefined;

  const addresses = await db.query.organizationAddresses.findMany({
    where: type
      ? and(
          eq(organizationAddresses.organizationId, auth.organizationId),
          eq(organizationAddresses.type, type)
        )
      : eq(organizationAddresses.organizationId, auth.organizationId),
    orderBy: (addresses, { desc }) => [desc(addresses.isDefault), desc(addresses.createdAt)],
  });

  return success(c, addresses);
});

// GET /internal/addresses/:id - Get a specific address
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const addressId = c.req.param("id");

  const address = await db.query.organizationAddresses.findFirst({
    where: and(
      eq(organizationAddresses.id, addressId),
      eq(organizationAddresses.organizationId, auth.organizationId)
    ),
  });

  if (!address) {
    throw Errors.notFound("Address");
  }

  return success(c, address);
});

// POST /internal/addresses - Create a new address
app.post("/", zValidator("json", createAddressSchema), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const data = c.req.valid("json");

  // If this is set as default, unset other defaults of same type
  if (data.isDefault) {
    await db
      .update(organizationAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(organizationAddresses.organizationId, auth.organizationId),
          eq(organizationAddresses.type, data.type),
          eq(organizationAddresses.isDefault, true)
        )
      );
  }

  const [address] = await db
    .insert(organizationAddresses)
    .values({
      organizationId: auth.organizationId,
      ...data,
    })
    .returning();

  return success(c, address, 201);
});

// PATCH /internal/addresses/:id - Update an address
app.patch("/:id", zValidator("json", updateAddressSchema), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const addressId = c.req.param("id");
  const data = c.req.valid("json");

  // Check address exists and belongs to org
  const existing = await db.query.organizationAddresses.findFirst({
    where: and(
      eq(organizationAddresses.id, addressId),
      eq(organizationAddresses.organizationId, auth.organizationId)
    ),
  });

  if (!existing) {
    throw Errors.notFound("Address");
  }

  // If setting as default, unset other defaults of same type
  if (data.isDefault) {
    const type = data.type || existing.type;
    await db
      .update(organizationAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(organizationAddresses.organizationId, auth.organizationId),
          eq(organizationAddresses.type, type),
          eq(organizationAddresses.isDefault, true)
        )
      );
  }

  const [updated] = await db
    .update(organizationAddresses)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(organizationAddresses.id, addressId))
    .returning();

  return success(c, updated);
});

// DELETE /internal/addresses/:id - Delete an address
app.delete("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const addressId = c.req.param("id");

  // Check address exists and belongs to org
  const existing = await db.query.organizationAddresses.findFirst({
    where: and(
      eq(organizationAddresses.id, addressId),
      eq(organizationAddresses.organizationId, auth.organizationId)
    ),
  });

  if (!existing) {
    throw Errors.notFound("Address");
  }

  await db
    .delete(organizationAddresses)
    .where(eq(organizationAddresses.id, addressId));

  return success(c, { deleted: true });
});

// POST /internal/addresses/:id/set-default - Set an address as default
app.post("/:id/set-default", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const addressId = c.req.param("id");

  // Check address exists and belongs to org
  const existing = await db.query.organizationAddresses.findFirst({
    where: and(
      eq(organizationAddresses.id, addressId),
      eq(organizationAddresses.organizationId, auth.organizationId)
    ),
  });

  if (!existing) {
    throw Errors.notFound("Address");
  }

  // Unset other defaults of same type
  await db
    .update(organizationAddresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(organizationAddresses.organizationId, auth.organizationId),
        eq(organizationAddresses.type, existing.type),
        eq(organizationAddresses.isDefault, true)
      )
    );

  // Set this one as default
  const [updated] = await db
    .update(organizationAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(organizationAddresses.id, addressId))
    .returning();

  return success(c, updated);
});

export default app;
