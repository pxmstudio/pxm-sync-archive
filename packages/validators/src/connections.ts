import { z } from "zod";
import {
  connectionId,
  organizationId,
  connectionStatus,
} from "./common.js";

// ============================================
// Create Connection
// ============================================

export const createConnection = z.object({
  supplierId: organizationId,
});

export type CreateConnection = z.infer<typeof createConnection>;

// ============================================
// Connection Response
// ============================================

export const connection = z.object({
  id: connectionId,
  supplierId: organizationId,
  retailerId: organizationId,
  status: connectionStatus,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Connection = z.infer<typeof connection>;

// Connection with related organization info
export const connectionWithOrgs = connection.extend({
  supplier: z.object({
    id: organizationId,
    name: z.string(),
    slug: z.string(),
    logoUrl: z.string().nullable(),
  }),
  retailer: z.object({
    id: organizationId,
    name: z.string(),
    slug: z.string(),
    logoUrl: z.string().nullable(),
  }),
});

export type ConnectionWithOrgs = z.infer<typeof connectionWithOrgs>;

// ============================================
// Connection List Filters
// ============================================

export const connectionFilters = z.object({
  status: connectionStatus.optional(),
  search: z.string().max(100).optional(),
});

export type ConnectionFilters = z.infer<typeof connectionFilters>;
