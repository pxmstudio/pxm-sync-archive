import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { apiKeyAuth } from "../../middleware/index.js";
import type { Env, Variables } from "../../types.js";
import { openApiConfig, securitySchemes } from "./openapi.js";

import products from "./products.js";
import inventory from "./inventory.js";
import webhooks from "./webhooks.js";
import facets from "./facets.js";
import catalog from "./catalog.js";

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// OpenAPI documentation endpoints (no auth required)
app.doc("/openapi.json", {
  ...openApiConfig,
  tags: [
    { name: "Products", description: "Product catalog operations" },
    { name: "Catalog", description: "Full catalog export in XML/CSV format" },
    { name: "Inventory", description: "Inventory tracking" },
    { name: "Facets", description: "Product filtering facets" },
  ],
});

// Swagger UI
app.get("/docs", swaggerUI({ url: "/api/v1/openapi.json" }));

// Register security schemes
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", securitySchemes.bearerAuth);

// Catalog route has its own auth middleware (supports api_key query param)
// Mount it before the global auth middleware
app.route("/catalog", catalog);

// All other public API routes require API key authentication via header
app.use("/*", apiKeyAuth);

// Mount routes
app.route("/products", products);
app.route("/inventory", inventory);
app.route("/webhooks", webhooks);
app.route("/facets", facets);

export default app;
