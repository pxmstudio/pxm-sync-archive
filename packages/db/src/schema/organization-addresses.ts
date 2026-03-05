import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { addressTypeEnum } from "./enums";
import { idGenerator } from "../lib/typeid";

export const organizationAddresses = pgTable(
  "organization_addresses",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("orgAddress")),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Human-readable label
    label: text("label").notNull(), // "Main Warehouse", "EU Fulfillment Center"

    // Address type
    type: addressTypeEnum("type").notNull(),

    // Whether this is the default address for shipping
    isDefault: boolean("is_default").default(false),

    // Address fields (matching the Address interface in orders.ts)
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    address1: text("address_1").notNull(),
    address2: text("address_2"),
    city: text("city").notNull(),
    state: text("state"),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull(),
    phone: text("phone"),
    email: text("email"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("organization_addresses_org_idx").on(table.organizationId),
    index("organization_addresses_default_idx").on(
      table.organizationId,
      table.isDefault
    ),
  ]
);

export type OrganizationAddress = typeof organizationAddresses.$inferSelect;
export type NewOrganizationAddress = typeof organizationAddresses.$inferInsert;
