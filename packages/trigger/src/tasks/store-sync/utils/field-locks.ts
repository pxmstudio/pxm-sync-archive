/**
 * Field lock utilities for product sync
 * Handles per-product metafield overrides that control which fields should not be synced
 */

import type { FieldLockConfig, LockableField } from "@workspace/db";
import { withThrottleRetry } from "./retry.js";

export type MetafieldsCache = Map<string, Array<{ namespace: string; key: string; value: string }>>;

/**
 * Fetch metafields for multiple products and return a map keyed by product GID.
 *
 * Accepts product IDs or full Shopify GIDs; IDs that are not full GIDs will be normalized.
 * Products that fail to fetch or have no metafields are omitted from the result.
 *
 * @param productIds - Array of product IDs or full Shopify GIDs to fetch metafields for
 * @returns A `MetafieldsCache` mapping each product GID to an array of metafield objects (`namespace`, `key`, `value`)
 */
export async function batchFetchProductMetafields(
  shopDomain: string,
  accessToken: string,
  productIds: string[]
): Promise<MetafieldsCache> {
  const metafieldsMap: MetafieldsCache = new Map();

  if (productIds.length === 0) return metafieldsMap;

  // Convert all IDs to GID format (Shopify's nodes query requires full GID)
  const gidProductIds = productIds.map(id =>
    id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`
  );

  // Shopify's nodes query can fetch up to 50 items at once
  const BATCH_SIZE = 50;
  const batches: string[][] = [];

  for (let i = 0; i < gidProductIds.length; i += BATCH_SIZE) {
    batches.push(gidProductIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`[FieldLocks] Batch fetching metafields for ${gidProductIds.length} products in ${batches.length} batches`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      // Use the nodes query to fetch multiple products at once
      const nodesQuery = `
        query ProductsMetafields($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              metafields(first: 50) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const data = await withThrottleRetry(
        async () => {
          const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: nodesQuery,
              variables: { ids: batch },
            }),
          });

          if (!response.ok) {
            // Throw error so withThrottleRetry can handle retries for 429/5xx
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json() as Promise<{
            data?: {
              nodes?: Array<{
                id: string;
                metafields?: {
                  edges: Array<{ node: { namespace: string; key: string; value: string } }>;
                };
              } | null>;
            };
            errors?: Array<{ message: string }>;
          }>;
        },
        { label: `batch-metafields-${batchIndex}` }
      );

      if (data.errors) {
        console.warn(`[FieldLocks] Batch ${batchIndex + 1} GraphQL errors:`, data.errors);
      }

      // Process results
      for (const node of data.data?.nodes || []) {
        if (node && node.id && node.metafields) {
          const metafields = node.metafields.edges.map(e => e.node);
          metafieldsMap.set(node.id, metafields);
        }
      }

      console.log(`[FieldLocks] Batch ${batchIndex + 1}/${batches.length} complete: fetched metafields for ${batch!.length} products`);

      // Small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn(`[FieldLocks] Batch ${batchIndex + 1} error:`, error);
    }
  }

  console.log(`[FieldLocks] Batch fetch complete: ${metafieldsMap.size}/${productIds.length} products have metafields`);
  return metafieldsMap;
}

/**
 * Determines which product fields should be locked based on pre-fetched metafields and a field-lock configuration.
 *
 * @param productId - Product identifier; may be a plain product ID or a Shopify GID.
 * @param fieldLockConfig - Configuration that includes `enabled`, `namespace`, `mappings`, and `lockInterpretation`; when missing or not enabled, no fields are locked.
 * @param metafieldsMap - Cache mapping product GIDs to arrays of metafields (`{ namespace, key, value }`) used to evaluate mappings.
 * @returns A set of lockable field names that should be locked according to the configuration and the corresponding metafield values.
 */
export function getLockedFieldsFromCache(
  productId: string,
  fieldLockConfig: FieldLockConfig | null,
  metafieldsMap: MetafieldsCache
): Set<LockableField> {
  const locked = new Set<LockableField>();

  if (!fieldLockConfig?.enabled) return locked;

  // Ensure GID format for lookup
  const gidProductId = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const metafields = metafieldsMap.get(gidProductId);
  if (!metafields) {
    // Product not in cache (might be new or wasn't fetched)
    return locked;
  }

  const lockInterpretation = fieldLockConfig.lockInterpretation || "lockWhenTrue";

  for (const [field, metafieldKeyOrFullKey] of Object.entries(fieldLockConfig.mappings)) {
    let metafield: { namespace: string; key: string; value: string } | undefined;

    if (metafieldKeyOrFullKey.includes(".")) {
      const [namespace, ...keyParts] = metafieldKeyOrFullKey.split(".");
      const key = keyParts.join(".");
      metafield = metafields.find((m) => m.namespace === namespace && m.key === key);
    } else {
      metafield = metafields.find((m) =>
        m.namespace === fieldLockConfig.namespace && m.key === metafieldKeyOrFullKey
      );
    }

    const rawValue = metafield?.value;
    const metafieldValue = String(rawValue || "").toLowerCase();

    if (lockInterpretation === "lockWhenTrue") {
      if (metafieldValue === "true") {
        locked.add(field as LockableField);
      }
    } else {
      if (metafieldValue === "false") {
        locked.add(field as LockableField);
      }
    }
  }

  return locked;
}

/**
 * Determine which product fields are locked based on the product's Shopify metafields.
 *
 * @deprecated Use batchFetchProductMetafields and getLockedFieldsFromCache for better performance.
 * @param shopDomain - Shopify store domain used to query the Admin API
 * @param accessToken - Admin API access token
 * @param productId - Product ID or GID identifying the product
 * @param fieldLockConfig - Configuration that maps product fields to metafields and controls lock interpretation
 * @returns A set of lockable field names that should be treated as locked for the product
 */
export async function getLockedFields(
  shopDomain: string,
  accessToken: string,
  productId: string,
  fieldLockConfig: FieldLockConfig | null
): Promise<Set<LockableField>> {
  const locked = new Set<LockableField>();

  if (!fieldLockConfig?.enabled) return locked;

  try {
    // Convert numeric product ID to GID format if needed
    const gidProductId = productId.startsWith("gid://")
      ? productId
      : `gid://shopify/Product/${productId}`;

    // Fetch product metafields from Shopify via GraphQL
    // Fetch all metafields (no namespace filter) to support fullKey format (namespace.key)
    const metafieldsQuery = `
      query ProductMetafields($id: ID!) {
        product(id: $id) {
          metafields(first: 50) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: metafieldsQuery,
        variables: { id: gidProductId },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const data = await response.json() as {
      data?: {
        product?: {
          metafields?: {
            edges: Array<{ node: { namespace: string; key: string; value: string } }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    // Log any GraphQL errors
    if (data.errors) {
      console.warn(`[FieldLocks] GraphQL errors:`, JSON.stringify(data.errors, null, 2));
    }

    // Check if product was found
    if (!data?.data?.product) {
      console.warn(`[FieldLocks] Product not found in Shopify for GID: ${gidProductId}`);
      return locked;
    }

    const metafields = data?.data?.product?.metafields?.edges || [];
    const lockInterpretation = fieldLockConfig.lockInterpretation || "lockWhenTrue";

    for (const [field, metafieldKeyOrFullKey] of Object.entries(fieldLockConfig.mappings)) {
      let metafield: { node: { namespace: string; key: string; value: string } } | undefined;

      if (metafieldKeyOrFullKey.includes(".")) {
        const [namespace, ...keyParts] = metafieldKeyOrFullKey.split(".");
        const key = keyParts.join(".");
        metafield = metafields.find((m) => m.node.namespace === namespace && m.node.key === key);
      } else {
        metafield = metafields.find((m) =>
          m.node.namespace === fieldLockConfig.namespace && m.node.key === metafieldKeyOrFullKey
        );
      }

      const metafieldValue = String(metafield?.node?.value || "").toLowerCase();

      if (lockInterpretation === "lockWhenTrue") {
        if (metafieldValue === "true") {
          locked.add(field as LockableField);
        }
      } else {
        if (metafieldValue === "false") {
          locked.add(field as LockableField);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch metafields for product ${productId}:`, error);
  }

  return locked;
}