import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { eventTypeEnum } from "./enums";
import { idGenerator } from "../lib/typeid";

// Event log for system events (inventory updates, order changes, etc.)
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("event")),

    // Event owner (supplier whose data changed)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Event type
    type: eventTypeEnum("type").notNull(),

    // Entity reference
    entityType: text("entity_type").notNull(), // product, variant, order, connection
    entityId: text("entity_id").notNull(),

    // Event payload
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),

    // Processing status
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("events_org_idx").on(table.organizationId),
    index("events_type_idx").on(table.type),
    index("events_processed_idx").on(table.processed),
    index("events_created_at_idx").on(table.createdAt),
  ]
);

// Webhook subscriptions for retailers to receive events
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("webhookSubscription")),

    // Retailer who owns this subscription
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Webhook endpoint URL
    url: text("url").notNull(),

    // Events to subscribe to
    eventTypes: text("event_types").array().notNull(),

    // Secret for signing webhook payloads (stored encrypted)
    secretRef: text("secret_ref"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Failure tracking
    failureCount: text("failure_count").default("0"),
    lastFailureAt: timestamp("last_failure_at"),
    lastFailureReason: text("last_failure_reason"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_subs_org_idx").on(table.organizationId),
    index("webhook_subs_active_idx").on(table.isActive),
  ]
);

// Webhook delivery log
export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("webhookLog")),

    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),

    eventId: text("event_id").references(() => events.id, {
      onDelete: "set null",
    }),

    // Delivery details
    url: text("url").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),

    // Response
    statusCode: text("status_code"),
    responseBody: text("response_body"),
    responseTimeMs: text("response_time_ms"),

    // Status
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),

    // Retry tracking
    attempt: text("attempt").notNull().default("1"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_logs_sub_idx").on(table.subscriptionId),
    index("webhook_logs_event_idx").on(table.eventId),
    index("webhook_logs_created_at_idx").on(table.createdAt),
  ]
);

// Track processed incoming webhook events for deduplication
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("processedWebhook")),

    // Provider (stripe, shopify, clerk, etc.)
    provider: text("provider").notNull(),

    // The unique event ID from the provider
    eventId: text("event_id").notNull(),

    // Event type for debugging/auditing
    eventType: text("event_type"),

    // When the event was processed
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique constraint on provider + eventId for deduplication
    uniqueIndex("processed_webhook_provider_event_idx").on(table.provider, table.eventId),
  ]
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type NewProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert;
