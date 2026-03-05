# @workspace/db

Database schema and migrations using Drizzle ORM with Neon PostgreSQL.

## Schema

| Table | Description |
|-------|-------------|
| `organizations` | Retailers and suppliers (role-based) |
| `users` | User accounts |
| `memberships` | User-to-organization relationships |
| `integrations` | Shopify store connections per org |
| `api_keys` | API keys for the public API |
| `feeds` | Supplier product feeds (Community Library) |
| `feed_sources` | Feed source config — URL, parser type, field mappings |
| `feed_subscriptions` | Retailer subscriptions to feeds |
| `feed_requests` | Retailer requests for new feeds |
| `products` | Product catalog |
| `variants` | Product variants (pricing, SKU, barcode) |
| `inventory` | Stock levels |
| `collections` | Product collections |
| `brands` | Brand records |
| `product_tags` | Product tags |
| `product_types` | Product type classification |
| `feed_subscription_sync_settings` | Per-subscription sync overrides |
| `retailer_field_mappings` | Global field mappings per integration |
| `feed_synced_products` | Tracks which products are synced to which store |
| `store_sync_runs` | Sync activity log |
| `events` | Event log |
| `webhook_subscriptions` | Webhook endpoints |
| `webhook_logs` | Webhook delivery log |
| `connections` | Supplier-to-retailer relationships |
| `organization_addresses` | Org contact/shipping addresses |
| `files` | Uploaded files (R2 references) |

IDs use [TypeID](https://github.com/jetify-com/typeid) — human-readable prefixed identifiers (`org_xxx`, `prd_xxx`, `feed_xxx`).

## Environment

```
DATABASE_URL=postgresql://user:password@host:5432/database
```

## Scripts

```bash
pnpm db:generate   # generate migrations from schema changes
pnpm db:migrate    # run migrations
pnpm db:push       # push schema directly (dev shortcut)
pnpm db:studio     # open Drizzle Studio browser UI
```
