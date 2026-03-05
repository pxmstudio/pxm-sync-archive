import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";
import { idGenerator } from "../lib/typeid";

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("collection")),

    // Owner (supplier)
    supplierId: text("supplier_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // External reference (e.g., Shopify collection ID)
    externalId: text("external_id"),

    // Collection info
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    description: text("description"),

    // Image
    imageUrl: text("image_url"),

    // Timestamps
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("collections_supplier_idx").on(table.supplierId),
    index("collections_external_id_idx").on(table.supplierId, table.externalId),
    index("collections_handle_idx").on(table.supplierId, table.handle),
  ]
);

// Junction table for many-to-many relationship between collections and products
export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: text("position").default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("collection_products_collection_idx").on(table.collectionId),
    index("collection_products_product_idx").on(table.productId),
  ]
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionProduct = typeof collectionProducts.$inferSelect;
export type NewCollectionProduct = typeof collectionProducts.$inferInsert;
