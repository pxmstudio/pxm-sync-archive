import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { idGenerator } from "../lib/typeid";

/**
 * Uploaded files - tracks files uploaded to R2 storage
 */
export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("uploadedFile")),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // R2 storage info
    key: text("key").notNull().unique(), // R2 object key (path)

    // File metadata
    filename: text("filename").notNull(), // Original filename
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(), // Size in bytes

    // Purpose/context - helps with access control and organization
    purpose: text("purpose").notNull(), // e.g., "registration_document", "application_attachment"
    entityType: text("entity_type"), // e.g., "organization", "connection"
    entityId: text("entity_id"), // ID of the related entity

    // Access control
    isPublic: boolean("is_public").default(false),

    // Audit
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("uploaded_files_organization_idx").on(table.organizationId),
    index("uploaded_files_purpose_idx").on(table.purpose),
    index("uploaded_files_entity_idx").on(table.entityType, table.entityId),
  ]
);

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
