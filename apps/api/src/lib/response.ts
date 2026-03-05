import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Success response helper
export function success<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ success: true as const, data }, status);
}

// Typed success response for OpenAPI routes (explicit 200 status)
export function success200<T>(c: Context, data: T) {
  return c.json({ success: true as const, data }, 200 as const);
}

// Typed success response for OpenAPI routes (explicit 201 status)
export function success201<T>(c: Context, data: T) {
  return c.json({ success: true as const, data }, 201 as const);
}

// Paginated response helper
export function paginated<T>(
  c: Context,
  items: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
  }
) {
  // Wrap items and pagination inside data so apiClient can unwrap it correctly
  return c.json({
    success: true as const,
    data: {
      items,
      pagination: {
        page: meta.page,
        limit: meta.limit,
        total: meta.total,
        totalPages: Math.ceil(meta.total / meta.limit),
      },
    },
  }, 200 as const);
}

// Cursor paginated response helper
export function cursorPaginated<T>(
  c: Context,
  data: T[],
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  }
) {
  return c.json({
    success: true,
    data,
    meta,
  });
}

// No content response
export function noContent(c: Context) {
  return c.body(null, 204);
}
