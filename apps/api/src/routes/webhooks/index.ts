import { Hono } from "hono";
import type { Env, Variables } from "../../types.js";

import clerk from "./clerk.js";
import shopify from "./shopify.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Webhook routes (no auth - verified by signatures)
app.route("/clerk", clerk);
app.route("/shopify", shopify);

export default app;
