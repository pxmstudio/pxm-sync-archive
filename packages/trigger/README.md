# @workspace/trigger

Background jobs powered by [Trigger.dev](https://trigger.dev) v4. Handles all async processing — feed parsing, store sync, notifications, and maintenance.

## Tasks

### Feed Sync (`tasks/feed-sync/`)

- **sync-feed** — fetches and parses a supplier's CSV/XML feed into the product catalog
- **scheduled-sync** — cron job that triggers feed syncs on schedule

### Store Sync (`tasks/store-sync/`)

- **push-products** — syncs products from a feed subscription to a Shopify store. Handles field mapping, pricing, filtering, change detection, and field locks.
- **scheduled-sync** — hourly cron that triggers store sync for all active subscriptions
- **bulk-change-status** — batch update product status (draft/active/archived)
- **cleanup-inactive-feeds** — removes products from inactive feed subscriptions

#### Sync utilities (`tasks/store-sync/utils/`)

- **change-detection** — content hashing to skip unchanged products
- **mappings** — applies field mappings with sync modes (always, create-only, if-empty)
- **pricing** — margin calculation with conditional rules and rounding
- **filters** — exclusion rules (brand, type, tag, price, stock)
- **field-locks** — prevents overwriting locked Shopify fields
- **transformers** — data transforms (trim, strip_html, decode_entities)
- **publications** — Shopify sales channel publishing

### Notifications (`tasks/notifications/`)

- **sync-notifications** — sends email after sync completes or fails
- **feed-request-notification** — notifies when a new feed is requested

### Digest (`tasks/digest/`)

- **weekly-digest** — weekly summary email per organization
- **monthly-digest** — monthly summary email per organization

### Maintenance (`tasks/maintenance/`)

- **backfill-hashes** — backfills content hashes on existing products
- **backfill-inventory-ids** — backfills Shopify inventory item IDs
- **reconcile-inventory** — reconciles inventory levels with Shopify
- **refresh-store-metadata** — refreshes Shopify store metadata (locations, channels)

### Webhooks (`tasks/webhooks/`)

- **retry-failed** — retries failed webhook deliveries

## Environment

```
DATABASE_URL=               # Neon PostgreSQL
TRIGGER_SECRET_KEY=         # Trigger.dev secret
GCP_KMS_PROJECT_ID=         # Google Cloud KMS (decrypt Shopify tokens)
GCP_KMS_LOCATION=
GCP_KMS_KEY_RING=
GCP_KMS_KEY=
GCP_SERVICE_ACCOUNT_JSON=   # base64-encoded service account JSON
```

## Scripts

```bash
pnpm dev      # start Trigger.dev dev server
pnpm deploy   # deploy tasks to Trigger.dev
```
