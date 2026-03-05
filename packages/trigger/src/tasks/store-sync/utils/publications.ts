/**
 * Publication/sales channel utilities for product sync
 */

import type { PublicationOverride } from "@workspace/db";

/**
 * Publish a product to configured Shopify sales channels based on an override or integration defaults.
 *
 * @param publicationOverride - Optional override that controls publishing behavior: use mode "none" to skip publishing, mode "override" with `publicationIds` to publish to specific channels; if not provided, integration defaults are used.
 * @param integrationPublications - Optional array of integration publications; when used, publications with `autoPublish: true` are selected for publishing.
 */
export async function publishToChannels(
  shopDomain: string,
  accessToken: string,
  productId: string,
  publicationOverride: PublicationOverride | null,
  integrationPublications: Array<{ id: string; autoPublish: boolean }> | undefined
): Promise<void> {
  // Determine which publications to use
  let publicationIds: string[] = [];

  if (publicationOverride?.mode === "none") {
    // Don't publish anywhere
    return;
  } else if (publicationOverride?.mode === "override" && publicationOverride.publicationIds) {
    publicationIds = publicationOverride.publicationIds;
  } else {
    // Use integration defaults
    publicationIds = (integrationPublications || [])
      .filter((p) => p.autoPublish)
      .map((p) => p.id);
  }

  if (publicationIds.length === 0) return;

  try {
    const mutation = `
      mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
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
        query: mutation,
        variables: {
          id: productId,
          input: publicationIds.map((pubId) => ({ publicationId: pubId })),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Failed to publish product ${productId}: HTTP ${response.status} - ${body}`);
      return;
    }

    const json = await response.json() as {
      data?: {
        publishablePublish?: {
          userErrors?: Array<{ field: string; message: string }>;
        };
      };
    };

    const userErrors = json?.data?.publishablePublish?.userErrors ?? [];
    if (userErrors.length > 0) {
      console.warn(`Publish userErrors for ${productId}:`, userErrors);
    }
  } catch (error) {
    console.warn(`Failed to publish product ${productId} to channels:`, error);
  }
}