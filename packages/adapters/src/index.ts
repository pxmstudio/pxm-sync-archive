// Auth adapters
export * from "./auth/index.js";

// E-commerce adapters
export * from "./ecommerce/index.js";

// KMS adapters
export * from "./kms/index.js";

// Re-export specific implementations for convenience
export { ClerkAuthAdapter, type ClerkAdapterConfig } from "./auth/clerk.js";
export { ShopifyAdapter, type ShopifyAdapterConfig } from "./ecommerce/shopify.js";
export { CustomApiAdapter, type CustomApiAdapterConfig } from "./ecommerce/custom.js";
export { GCPKMSAdapter, type GCPKMSAdapterConfig, createGCPKMSAdapterFromEnv } from "./kms/gcp.js";
