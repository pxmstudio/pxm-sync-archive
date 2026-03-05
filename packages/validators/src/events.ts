import { z } from "zod";
import {
  eventId,
  webhookSubscriptionId,
  webhookLogId,
  organizationId,
  typeId,
  url,
  eventType,
} from "./common.js";

// ============================================
// Event
// ============================================

export const event = z.object({
  id: eventId,
  organizationId: organizationId,
  type: eventType,
  entityType: z.string(),
  entityId: typeId, // Can be any entity ID
  payload: z.record(z.unknown()),
  processed: z.boolean(),
  processedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type Event = z.infer<typeof event>;

// ============================================
// Event List Filters
// ============================================

export const eventFilters = z.object({
  type: eventType.optional(),
  entityType: z.string().optional(),
  entityId: typeId.optional(),
  processed: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type EventFilters = z.infer<typeof eventFilters>;

// ============================================
// Webhook Subscription
// ============================================

export const createWebhookSubscription = z.object({
  url: url,
  eventTypes: z.array(eventType).min(1),
});

export type CreateWebhookSubscription = z.infer<typeof createWebhookSubscription>;

export const updateWebhookSubscription = z.object({
  url: url.optional(),
  eventTypes: z.array(eventType).min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookSubscription = z.infer<typeof updateWebhookSubscription>;

export const webhookSubscription = z.object({
  id: webhookSubscriptionId,
  organizationId: organizationId,
  url: z.string(),
  eventTypes: z.array(eventType),
  isActive: z.boolean(),
  failureCount: z.string(),
  lastFailureAt: z.coerce.date().nullable(),
  lastFailureReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WebhookSubscription = z.infer<typeof webhookSubscription>;

// ============================================
// Webhook Delivery
// ============================================

export const webhookDelivery = z.object({
  id: webhookLogId,
  subscriptionId: webhookSubscriptionId,
  eventId: eventId.nullable(),
  url: z.string(),
  eventType: z.string(),
  payload: z.record(z.unknown()).nullable(),
  statusCode: z.string().nullable(),
  responseBody: z.string().nullable(),
  responseTimeMs: z.string().nullable(),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
  attempt: z.string(),
  createdAt: z.coerce.date(),
});

export type WebhookDelivery = z.infer<typeof webhookDelivery>;

// ============================================
// Webhook Payload (what we send to retailers)
// ============================================

export const webhookPayload = z.object({
  id: z.string(), // Delivery ID
  eventId: z.string(),
  eventType: eventType,
  timestamp: z.string(), // ISO 8601
  data: z.record(z.unknown()),
});

export type WebhookPayload = z.infer<typeof webhookPayload>;

// ============================================
// Test Webhook
// ============================================

export const testWebhook = z.object({
  subscriptionId: webhookSubscriptionId,
  eventType: eventType.optional(),
});

export type TestWebhook = z.infer<typeof testWebhook>;

// ============================================
// Webhook Delivery Filters
// ============================================

export const webhookDeliveryFilters = z.object({
  subscriptionId: webhookSubscriptionId.optional(),
  success: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type WebhookDeliveryFilters = z.infer<typeof webhookDeliveryFilters>;
