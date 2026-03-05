# Web

Next.js 15 retailer dashboard. Deployed to Cloudflare Workers via OpenNext.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/feeds` | Browse and subscribe to supplier feeds |
| `/feeds/[id]` | Feed detail — products, sync settings, field mappings |
| `/products` | Product catalog with compare view |
| `/sync` | Global sync settings — field mappings, pricing, filters |
| `/activity` | Sync history and error logs |
| `/settings` | General organization settings |
| `/settings/integrations` | Shopify store connections |
| `/settings/api-keys` | API key management |
| `/settings/webhooks` | Webhook configuration |
| `/settings/team` | Team member management |
| `/settings/notifications` | Notification preferences |

## Stack

- **Framework**: Next.js 15 with React 19 and Turbopack
- **Auth**: Clerk
- **Styling**: Tailwind CSS 4, shadcn/ui (via `@workspace/ui`)
- **Data fetching**: TanStack React Query
- **Tables**: TanStack React Table
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **i18n**: `@workspace/i18n` (English, Romanian)

## Environment Variables

```
DATABASE_URL=                              # Neon PostgreSQL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=         # Clerk public key
CLERK_SECRET_KEY=                          # Clerk secret
NEXT_PUBLIC_API_URL=                       # API URL (e.g. http://localhost:8787/api)
```

## Scripts

```bash
pnpm dev       # dev server on port 3004 (turbopack)
pnpm build     # production build
pnpm deploy    # build + deploy to Cloudflare
pnpm preview   # build + local preview
```
