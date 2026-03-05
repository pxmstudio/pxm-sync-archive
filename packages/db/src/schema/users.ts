import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idGenerator } from "../lib/typeid";

/**
 * Minimal users table - kept for FK references (e.g., files.uploadedBy)
 * User profile data (firstName, lastName, avatarUrl) should be fetched from Clerk SDK
 */
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(idGenerator("user")),

  // External auth provider ID (Clerk)
  externalAuthId: text("external_auth_id").notNull().unique(),

  // Email cached for display purposes (not authoritative - Clerk is source of truth)
  email: text("email").notNull().unique(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // NOTE: firstName, lastName, name, avatarUrl, lastSignInAt removed
  // Use Clerk SDK: clerkClient.users.getUser(externalAuthId) for profile data
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
