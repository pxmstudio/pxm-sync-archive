/**
 * Cleanup task for inactive feeds
 *
 * When a feed is deactivated or removed from a store's subscriptions,
 * this task sets all products from that feed to DRAFT status in Shopify.
 */

import { task } from "@trigger.dev/sdk";
import { eq, and, inArray } from "drizzle-orm";
import {
  createDb,
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  integrations,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";

// ============================================
// Types
// ============================================

export interface InactiveFeedCleanupPayload {
  /** The organization ID that owns the integrations */
  organizationId: string;
  /** Optional: specific integration ID to clean up */
  integrationId?: string;
  /** Optional: specific feed ID that was deactivated */
  feedId?: string;
}

// ============================================
// Task
// ============================================

export const cleanupInactiveFeedsTask = task({
  id: "cleanup-inactive-feeds",
  maxDuration: 600, // 10 minutes
  run: async (payload: InactiveFeedCleanupPayload) => {
    const db = createDb(process.env.DATABASE_URL!);

    console.log(`Starting inactive feed cleanup for organization ${payload.organizationId}`);

    // Get all active feed subscriptions for this organization
    const activeSubscriptions = await db
      .select({
        subscriptionId: feedSubscriptions.id,
        feedId: feedSubscriptions.feedId,
        retailerId: feedSubscriptions.retailerId,
      })
      .from(feedSubscriptions)
      .where(
        and(
          eq(feedSubscriptions.retailerId, payload.organizationId),
          eq(feedSubscriptions.isActive, true)
        )
      );

    const activeFeedIds = activeSubscriptions.map((s) => s.feedId);

    console.log(`Found ${activeFeedIds.length} active feed subscriptions`);

    // Get all integrations for this organization
    let integrationsQuery = db
      .select({
        id: integrations.id,
        externalIdentifier: integrations.externalIdentifier,
        credentialsRef: integrations.credentialsRef,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, payload.organizationId),
          eq(integrations.isActive, "true"),
          eq(integrations.provider, "shopify")
        )
      );

    if (payload.integrationId) {
      integrationsQuery = db
        .select({
          id: integrations.id,
          externalIdentifier: integrations.externalIdentifier,
          credentialsRef: integrations.credentialsRef,
        })
        .from(integrations)
        .where(
          and(
            eq(integrations.organizationId, payload.organizationId),
            eq(integrations.id, payload.integrationId),
            eq(integrations.isActive, "true"),
            eq(integrations.provider, "shopify")
          )
        );
    }

    const orgIntegrations = await integrationsQuery;

    let totalDrafted = 0;

    for (const integration of orgIntegrations) {
      if (!integration.externalIdentifier || !integration.credentialsRef) {
        console.warn(`Skipping integration ${integration.id}: missing credentials`);
        continue;
      }

      // Get sync settings for this integration
      const syncSettingsList = await db
        .select({
          id: feedSubscriptionSyncSettings.id,
          subscriptionId: feedSubscriptionSyncSettings.subscriptionId,
        })
        .from(feedSubscriptionSyncSettings)
        .where(eq(feedSubscriptionSyncSettings.integrationId, integration.id));

      // Get subscriptions that are no longer active
      const inactiveSubscriptionIds: string[] = [];

      for (const syncSettings of syncSettingsList) {
        const subscription = await db.query.feedSubscriptions.findFirst({
          where: eq(feedSubscriptions.id, syncSettings.subscriptionId),
        });

        // If subscription doesn't exist or is inactive, add to cleanup list
        if (!subscription || !subscription.isActive) {
          inactiveSubscriptionIds.push(syncSettings.subscriptionId);
        }

        // If a specific feedId was deactivated, check for it
        if (payload.feedId && subscription?.feedId === payload.feedId && !subscription.isActive) {
          inactiveSubscriptionIds.push(syncSettings.subscriptionId);
        }
      }

      if (inactiveSubscriptionIds.length === 0) {
        console.log(`No inactive subscriptions for integration ${integration.id}`);
        continue;
      }

      console.log(`Found ${inactiveSubscriptionIds.length} inactive subscriptions for integration ${integration.id}`);

      // Get synced products for inactive subscriptions
      const productsToCleanup = await db
        .select({
          id: feedSyncedProducts.id,
          externalProductId: feedSyncedProducts.externalProductId,
          syncSettingsId: feedSyncedProducts.syncSettingsId,
        })
        .from(feedSyncedProducts)
        .innerJoin(
          feedSubscriptionSyncSettings,
          eq(feedSyncedProducts.syncSettingsId, feedSubscriptionSyncSettings.id)
        )
        .where(
          and(
            eq(feedSubscriptionSyncSettings.integrationId, integration.id),
            inArray(feedSubscriptionSyncSettings.subscriptionId, inactiveSubscriptionIds)
          )
        );

      if (productsToCleanup.length === 0) {
        console.log(`No products to clean up for integration ${integration.id}`);
        continue;
      }

      console.log(`Drafting ${productsToCleanup.length} products for inactive feeds`);

      // Get access token
      let accessToken: string;
      try {
        accessToken = await getShopifyAccessToken({
          credentialsRef: integration.credentialsRef,
        });
      } catch (error) {
        console.error(`Failed to get credentials for integration ${integration.id}:`, error);
        continue;
      }

      // Create Shopify adapter
      const shopifyAdapter = new ShopifyAdapter({
        shopDomain: integration.externalIdentifier,
        accessToken,
      });

      // Set each product to DRAFT
      for (const product of productsToCleanup) {
        if (!product.externalProductId) continue;

        try {
          await shopifyAdapter.updateProduct(product.externalProductId, {
            status: "draft",
          });
          totalDrafted++;

          // Update sync status
          await db
            .update(feedSyncedProducts)
            .set({
              syncStatus: "synced",
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(feedSyncedProducts.id, product.id));
        } catch (error) {
          console.error(`Failed to draft product ${product.externalProductId}:`, error);
        }
      }
    }

    console.log(`Cleanup complete. Drafted ${totalDrafted} products.`);

    return {
      success: true,
      productsDrafted: totalDrafted,
    };
  },
});
