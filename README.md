# PXM Sync (Archive)

> **This repository is an archive.** PXM Sync has been shut down as a SaaS product. This codebase is published to help existing clients transition to their own custom-built solution. Feel free to fork, extract, and adapt any part of it.
>
> **This repo will be made private on June 1, 2026.** Fork it before then if you need continued access.

## What Was PXM Sync?

PXM Sync was a product synchronization platform for e-commerce retailers. It let you subscribe to supplier product feeds (CSV/XML), apply field mappings and pricing rules, and push products directly into your Shopify store — all on autopilot.

**Core workflow:** Supplier Feed (CSV/XML) → Parse & Normalize → Apply Mappings, Pricing & Filters → Push to Shopify

## Repository Structure

This is a pnpm monorepo with Turborepo.

```
apps/
  api/                 Hono API running on Cloudflare Workers
  web/                 Next.js 15 retailer dashboard

packages/
  db/                  PostgreSQL schema & migrations (Drizzle ORM, Neon)
  adapters/            Shopify GraphQL integration, KMS encryption
  trigger/             Background jobs (Trigger.dev) — feed parsing, store sync, scheduling
  validators/          Zod schemas shared across apps
  ui/                  React component library (shadcn/ui)
  email/               Email templates (React Email)
  i18n/                Translations (English, Romanian)
  utils/               Reference data (countries, currencies, regions)

docs/
  seed-*.sql           Database seed scripts for each supplier feed (9 feeds)
  custom-feeds/        Sample CSV product data files (~60 MB total)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui |
| Backend API | Hono (Cloudflare Workers) |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Clerk |
| E-commerce | Shopify Admin API (GraphQL) |
| Background Jobs | Trigger.dev |
| Email | React Email + Resend |
| Encryption | Google Cloud KMS |
| File Storage | Cloudflare R2 |

## Feeds & Seed Data

The `docs/` directory contains everything you need to bootstrap feeds for the suppliers that were live on PXM Sync. Each supplier has a **seed SQL script** and a corresponding **CSV data file**.

### Seed Scripts (`docs/seed-*.sql`)

Each script inserts a `feeds` row and a `feed_sources` configuration row. The feed source config includes:

- **Feed URL** — the supplier's CSV/XML endpoint
- **Field mappings** — which source columns map to which product fields (sku, name, price, description, images, etc.)
- **Transforms** — post-processing pipeline (trim, strip_html, decode_entities)
- **Parser options** — delimiter, image delimiter, currency, stock status mapping, decimal separator

Run them against your database after applying the schema migrations:

```bash
pnpm db:push                          # apply schema
psql $DATABASE_URL -f docs/seed-aleo.sql  # seed a feed
```

### Available Feeds

| Supplier | Type | Seed Script | CSV Data | Categories |
|----------|------|-------------|----------|------------|
| Aleo | CSV | `seed-aleo.sql` | `aleo.csv` (4.8 MB) | Auto accessories, roof boxes, bike carriers |
| BabyNeeds | CSV | `seed-babyneeds.sql` | `babyneeds.csv` (23 MB) | Baby furniture, nursery |
| BabySafe | CSV | `seed-babysafe.sql` | `babysafe.csv` (2.1 MB) | Baby safety products |
| BebeBrands | CSV | `seed-bebebrands.sql` | `bebebrands.csv` (5.1 MB) | Baby brands, multi-category |
| Chicco Romania | XML | `seed-chicco.sql` | — | Baby products, strollers, car seats, toys |
| Hubner's | CSV | `seed-hubners.sql` | — | Supplements, natural products |
| Kids Concept | CSV | `seed-kids-concept.sql` | `kids-concept.csv` (1.8 MB) | Kids products |
| Smart Baby | CSV | `seed-smart-baby.sql` | `smart-baby.csv` (2.5 MB) | Baby products |
| Viva Toys | CSV | `seed-vivatoys.sql` | `vivatoys.csv` (13 MB) | Toys |

> **Note:** Chicco and Hubner's use live feed URLs and don't have CSV snapshots in this repo. The CSV files in `docs/custom-feeds/` are point-in-time snapshots of the other suppliers' feeds.

## Key Concepts

### Feed Source Configuration

A feed source defines how to parse a supplier's data file. The `mapping` JSON column on `feed_sources` contains:

```jsonc
{
  "fields": {
    "sku": "Cod produs",       // source column → product field
    "name": "Denumire",
    "price": "Pret",
    "images": "Imagine principala",
    // ...
  },
  "transforms": [
    { "field": "name", "type": "strip_html" },
    { "field": "name", "type": "decode_entities" },
    { "field": "name", "type": "trim" }
  ],
  "options": {
    "delimiter": ";",
    "hasHeader": true,
    "imageDelimiter": ",",
    "defaultCurrency": "RON",
    "priceDecimalSeparator": ".",
    "stockStatusMapping": { "in stoc": 100, "indisponibil": 0 }
  }
}
```

### Sync Settings

Each feed subscription supports per-subscription overrides on top of global defaults:

- **Sync modes** — `Always`, `Create Only`, `If Empty` (per field)
- **Field locks** — prevent specific Shopify fields from being overwritten
- **Exclusion rules** — skip products by brand, type, tag, price range, or stock
- **Pricing margins** — percentage or fixed markup, with conditional rules (by brand, type, price range, etc.) and rounding strategies
- **SKU prefix** — automatically prepend a prefix to all product SKUs
- **Product status** — default to Draft, Active, or Archived on creation
- **Sales channels** — auto-publish to selected Shopify sales channels

### Store Sync Pipeline

The sync pipeline in `packages/trigger/src/tasks/store-sync/` handles:

1. **Change detection** — content hashing to skip unchanged products
2. **Field mapping** — applying source-to-Shopify field mappings with sync mode rules
3. **Pricing** — margin calculation with conditional rules and rounding
4. **Filtering** — exclusion rules and product filters
5. **Field locks** — respecting locked fields that shouldn't be overwritten
6. **Shopify push** — creating/updating products via GraphQL Admin API

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10.4+
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- [Clerk](https://clerk.com) account
- [Shopify Partner](https://partners.shopify.com) account
- [Trigger.dev](https://trigger.dev) account

### Install & Configure

```bash
pnpm install
```

Set up environment files:

**`packages/db/.env`**
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

**`apps/web/.env.local`**
```
DATABASE_URL=postgresql://user:password@host:5432/database
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8787/api
```

**`apps/api/.dev.vars`**
```
DATABASE_URL=postgresql://user:password@host:5432/database
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=...
```

**`packages/trigger/.env`**
```
DATABASE_URL=postgresql://user:password@host:5432/database
TRIGGER_SECRET_KEY=tr_dev_...
GCP_KMS_PROJECT_ID=...
GCP_KMS_LOCATION=...
GCP_KMS_KEY_RING=...
GCP_KMS_KEY=...
GCP_SERVICE_ACCOUNT_JSON=...  # base64-encoded service account JSON
```

### Database

```bash
pnpm db:generate    # generate migrations from schema
pnpm db:push        # push schema directly (dev)
pnpm db:migrate     # run migrations (production)
pnpm db:studio      # open Drizzle Studio
```

### Development

```bash
pnpm dev
```

- Web dashboard: http://localhost:3000
- API: http://localhost:8787/api

## License

Restricted Use License — see [LICENSE](./LICENSE). You may use and modify this code for internal business purposes. You may not resell it or distribute it as a commercial product or service.
