import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { errorHandler, database } from "./middleware/index.js";
import type { Env, Variables } from "./types.js";

import internalRoutes from "./routes/internal/index.js";
import publicRoutes from "./routes/public/index.js";
import webhookRoutes from "./routes/webhooks/index.js";
import publicInfoRoutes from "./routes/public-info.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath("/api");

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      // Allow requests from our apps
      const allowedOrigins = [
        c.env.SUPPLIER_APP_URL,
        c.env.RETAILER_APP_URL,
        // Local development origins
        "http://localhost:3000",
        "http://localhost:3004",
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        return origin || "*";
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Supplier-ID", "X-Active-Role"],
    exposeHeaders: ["X-Request-ID"],
    maxAge: 86400,
    credentials: true,
  })
);

// Database middleware (all routes need DB access)
app.use("*", database);

// Error handler
app.onError(errorHandler);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "PXM Sync API",
    version: "1.0.0",
    status: "healthy",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.route("/public", publicInfoRoutes); // Truly public endpoints (no auth)
app.route("/internal", internalRoutes); // Internal API for apps (Clerk auth)
app.route("/v1", publicRoutes); // Public API for retailers (API key auth)
app.route("/webhooks", webhookRoutes); // Incoming webhooks (signature verification)

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

export default app;
