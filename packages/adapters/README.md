# @workspace/adapters

External service adapters for authentication, e-commerce platforms, and encryption.

## Adapters

### Auth (`./auth`)

Clerk authentication adapter. Handles JWT verification and user identity resolution.

### E-commerce (`./ecommerce/shopify`)

Shopify Admin API integration via GraphQL. Handles:

- Product creation and updates
- Variant management
- Inventory level syncing
- Image uploads
- Collection management
- Sales channel publishing

### KMS (`./kms`)

Google Cloud KMS adapter for encrypting and decrypting sensitive credentials (Shopify access tokens, API secrets).

### Webhooks

Svix integration for outbound webhook delivery and signature verification.

## Dependencies

- `@clerk/backend` — Clerk auth SDK
- `@shopify/shopify-api` — Shopify Admin API client
- `@google-cloud/kms` — Google Cloud KMS
- `svix` — webhook infrastructure
