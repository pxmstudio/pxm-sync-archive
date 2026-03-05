import {
  pgTable,
  integer,
  timestamp,
  text,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { variants } from "./products";
import { idGenerator } from "../lib/typeid";

// Inventory levels for variants
// We track aggregated inventory (not per-warehouse)
export const inventory = pgTable(
  "inventory",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("inventory")),

    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),

    // Available quantity (aggregated across all locations)
    quantity: integer("quantity").notNull().default(0),

    // Reserved quantity (held for pending orders)
    reserved: integer("reserved").notNull().default(0),

    // Low stock threshold for alerts
    lowStockThreshold: integer("low_stock_threshold"),

    // Change tracking for incremental sync
    previousQuantity: integer("previous_quantity"), // Quantity before last change
    changedAt: timestamp("changed_at"),             // When quantity last changed
    inventoryHash: text("inventory_hash"),          // Hash of inventory for change detection

    // Timestamps
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One inventory record per variant
    unique("inventory_variant_unique").on(table.variantId),
    index("inventory_variant_idx").on(table.variantId),
    index("inventory_changed_at_idx").on(table.changedAt),
  ]
);

// Computed: available = quantity - reserved

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
