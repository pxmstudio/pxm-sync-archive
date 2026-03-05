import {
  pgTable,
  text,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { connectionStatusEnum } from "./enums";
import { idGenerator } from "../lib/typeid";

// Connection between a supplier and retailer for sync purposes
export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("connection")),

    supplierId: text("supplier_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    retailerId: text("retailer_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    status: connectionStatusEnum("status").notNull().default("active"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // A supplier-retailer pair can only have one connection
    unique("connection_pair_unique").on(table.supplierId, table.retailerId),
    // Prevent self-connections (organization connecting to itself)
    check("no_self_connection", sql`${table.supplierId} != ${table.retailerId}`),
    index("connections_supplier_idx").on(table.supplierId),
    index("connections_retailer_idx").on(table.retailerId),
    index("connections_status_idx").on(table.status),
  ]
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
