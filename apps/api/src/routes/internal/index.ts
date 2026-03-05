import { Hono } from "hono";
import { auth } from "../../middleware/index.js";
import type { Env, Variables } from "../../types.js";

import organizations from "./organizations.js";
import products from "./products.js";
import collections from "./collections.js";
import integrations from "./integrations.js";
import apiKeysRoutes from "./api-keys.js";
import brands from "./brands.js";
import tags from "./tags.js";
import productTypes from "./product-types.js";
import variantsRoutes from "./variants.js";
import uploads from "./uploads.js";
import webhooks from "./webhooks.js";
import addresses from "./addresses.js";
import feeds from "./feeds.js";
import subscriptions from "./subscriptions.js";
import fieldMappings from "./field-mappings.js";
import activity from "./activity.js";
import migration from "./migration.js";
import shop from "./shop.js";
import bootstrap from "./bootstrap.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All internal routes require authentication
app.use("/*", auth);

// Mount routes
app.route("/organizations", organizations);
app.route("/products", products);
app.route("/collections", collections);
app.route("/integrations", integrations);
app.route("/api-keys", apiKeysRoutes);
app.route("/brands", brands);
app.route("/tags", tags);
app.route("/product-types", productTypes);
app.route("/variants", variantsRoutes);
app.route("/uploads", uploads);
app.route("/webhooks", webhooks);
app.route("/addresses", addresses);
app.route("/feeds", feeds);
app.route("/subscriptions", subscriptions);
app.route("/field-mappings", fieldMappings);
app.route("/activity", activity);
app.route("/migration", migration);
app.route("/shop", shop);
app.route("/bootstrap", bootstrap);

export default app;
