# API

Hono REST API running on Cloudflare Workers. Handles all backend logic for the PXM Sync platform.

## Routes

### Internal (`/api/internal/*`) — Clerk JWT auth

Used by the web dashboard. Requires a valid Clerk session.

- `/organizations` — organization management
- `/products` — product CRUD
- `/feeds` — feed browsing and management
- `/subscriptions` — feed subscriptions
- `/field-mappings` — sync field configuration
- `/integrations` — Shopify store connections
- `/activity` — sync history and logs
- `/api-keys` — API key management
- `/webhooks` — webhook configuration
- `/shop` — storefront/catalog settings
- `/bootstrap` — initial setup data

### Public API (`/api/v1/*`) — API key auth

For external integrations. Requires a `pxm_live_*` or `pxm_test_*` bearer token.

- `/products` — query products with filtering
- `/inventory` — stock levels
- `/catalog` — full catalog export (XML/CSV)
- `/facets` — product filtering facets
- `/webhooks` — webhook subscriptions

### Webhooks (`/api/webhooks/*`) — signature verification

Incoming webhooks from external services:

- `/clerk` — organization and user lifecycle events
- `/shopify` — store events

## Middleware

| Middleware | Purpose |
|-----------|---------|
| `auth` | Clerk JWT verification, auto-creates user records |
| `apiKeyAuth` | API key validation (SHA-256 hash lookup) |
| `database` | Neon PostgreSQL connection via Drizzle |
| `feedContext` | Resolves feed ID for public API routes |
| `errorHandler` | Structured error responses |
| `requireSupplier` / `requireRetailer` | Role enforcement |

## Environment Variables

```
DATABASE_URL=               # Neon PostgreSQL connection string
CLERK_SECRET_KEY=           # Clerk backend secret
CLERK_WEBHOOK_SECRET=       # Clerk webhook signature secret
TRIGGER_SECRET_KEY=         # Trigger.dev SDK secret
GCP_KMS_PROJECT_ID=         # Google Cloud KMS (for encrypting Shopify tokens)
GCP_KMS_LOCATION=
GCP_KMS_KEY_RING=
GCP_KMS_KEY=
GCP_SERVICE_ACCOUNT_JSON=
APP_URL=                    # Web app URL (for CORS)
API_URL=                    # This API's public URL
```

Cloudflare bindings: `R2_DOCS` (R2 bucket for file storage).

## Scripts

```bash
pnpm dev          # local dev server (wrangler)
pnpm build        # type-check
pnpm deploy       # deploy to Cloudflare Workers
pnpm cf-typegen   # generate Cloudflare bindings types
```
