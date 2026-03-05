/**
 * Custom API E-commerce Adapter
 *
 * Implementation of EcommerceAdapter for custom/generic APIs.
 * Retailers implement our spec, this adapter consumes it.
 */

import type {
  EcommerceAdapter,
  EcommerceProduct,
  EcommerceOrder,
  EcommerceInventoryLevel,
  EcommerceWebhookPayload,
  EcommerceWebhookTopic,
  CreateOrderInput,
  InventoryAdjustment,
  PaginatedResult,
} from "./types.js";

export interface CustomApiAdapterConfig {
  /** Base URL of the custom API */
  baseUrl: string;

  /** Authentication type */
  authType: "api_key" | "oauth" | "basic";

  /** API key (for api_key auth) */
  apiKey?: string;

  /** OAuth access token (for oauth auth) */
  accessToken?: string;

  /** Basic auth username (for basic auth) */
  username?: string;

  /** Basic auth password (for basic auth) */
  password?: string;

  /** Webhook secret for verifying webhooks */
  webhookSecret?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

export class CustomApiAdapter implements EcommerceAdapter {
  readonly provider = "custom";

  private config: CustomApiAdapterConfig;
  private baseUrl: string;

  constructor(config: CustomApiAdapterConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  // ============================================
  // Products
  // ============================================

  async listProducts(
    cursor?: string | null,
    limit: number = 50
  ): Promise<PaginatedResult<EcommerceProduct>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(cursor ? { cursor } : {}),
    });

    const response = await this.request<{
      data: EcommerceProduct[];
      meta: { nextCursor: string | null; hasMore: boolean };
    }>(`/products?${params}`);

    return {
      items: response.data,
      nextCursor: response.meta.nextCursor,
      hasMore: response.meta.hasMore,
    };
  }

  async getProduct(externalId: string): Promise<EcommerceProduct | null> {
    try {
      const response = await this.request<{ data: EcommerceProduct }>(
        `/products/${externalId}`
      );
      return response.data;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async *iterateProducts(): AsyncGenerator<EcommerceProduct, void, unknown> {
    let cursor: string | null = null;

    do {
      const result = await this.listProducts(cursor, 50);

      for (const product of result.items) {
        yield product;
      }

      cursor = result.nextCursor;
    } while (cursor);
  }

  // ============================================
  // Inventory
  // ============================================

  async getInventoryLevels(
    inventoryItemIds: string[]
  ): Promise<Map<string, EcommerceInventoryLevel>> {
    const response = await this.request<{
      data: Array<EcommerceInventoryLevel & { inventoryItemId: string }>;
    }>("/inventory", {
      method: "POST",
      body: JSON.stringify({ inventoryItemIds }),
    });

    const result = new Map<string, EcommerceInventoryLevel>();
    for (const level of response.data) {
      result.set(level.inventoryItemId, level);
    }

    return result;
  }

  async adjustInventory(adjustment: InventoryAdjustment): Promise<void> {
    await this.request("/inventory/adjust", {
      method: "POST",
      body: JSON.stringify(adjustment),
    });
  }

  async setInventory(
    inventoryItemId: string,
    quantity: number,
    locationId?: string
  ): Promise<void> {
    await this.request("/inventory/set", {
      method: "POST",
      body: JSON.stringify({
        inventoryItemId,
        quantity,
        locationId,
      }),
    });
  }

  // ============================================
  // Orders
  // ============================================

  async createOrder(input: CreateOrderInput): Promise<EcommerceOrder> {
    const response = await this.request<{ data: EcommerceOrder }>("/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return response.data;
  }

  async getOrder(externalId: string): Promise<EcommerceOrder | null> {
    try {
      const response = await this.request<{ data: EcommerceOrder }>(
        `/orders/${externalId}`
      );
      return response.data;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async cancelOrder(externalId: string, reason?: string): Promise<void> {
    await this.request(`/orders/${externalId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async fulfillOrder(
    externalId: string,
    trackingInfo?: {
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
    }
  ): Promise<void> {
    await this.request(`/orders/${externalId}/fulfill`, {
      method: "POST",
      body: JSON.stringify(trackingInfo || {}),
    });
  }

  // ============================================
  // Webhooks
  // ============================================

  async registerWebhooks(
    topics: EcommerceWebhookTopic[],
    callbackUrl: string
  ): Promise<void> {
    await this.request("/webhooks", {
      method: "POST",
      body: JSON.stringify({
        topics,
        callbackUrl,
      }),
    });
  }

  async verifyWebhook(request: Request): Promise<boolean> {
    if (!this.config.webhookSecret) {
      console.warn("Webhook secret not configured");
      return false;
    }

    const signature = request.headers.get("X-Webhook-Signature");
    if (!signature) {
      return false;
    }

    const body = await request.clone().text();

    // Compute HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.config.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );
    const computedSignature = this.arrayBufferToHex(signatureBytes);

    return computedSignature === signature;
  }

  async parseWebhook(request: Request): Promise<EcommerceWebhookPayload | null> {
    const topic = request.headers.get("X-Webhook-Topic") as EcommerceWebhookTopic;
    const shopId = request.headers.get("X-Shop-ID");

    if (!topic || !shopId) {
      return null;
    }

    const data = await request.json();

    return {
      topic,
      shopId,
      data: data as Record<string, unknown>,
      timestamp: new Date(),
    };
  }

  // ============================================
  // Connection
  // ============================================

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.request("/health");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getShopInfo(): Promise<{
    id: string;
    name: string;
    domain: string;
    email: string | null;
    currency: string;
    timezone: string | null;
  }> {
    const response = await this.request<{
      data: {
        id: string;
        name: string;
        domain: string;
        email: string | null;
        currency: string;
        timezone: string | null;
      };
    }>("/shop");

    return response.data;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.config.headers,
    };

    // Add authentication header
    switch (this.config.authType) {
      case "api_key":
        if (this.config.apiKey) {
          headers["X-API-Key"] = this.config.apiKey;
        }
        break;
      case "oauth":
        if (this.config.accessToken) {
          headers["Authorization"] = `Bearer ${this.config.accessToken}`;
        }
        break;
      case "basic":
        if (this.config.username && this.config.password) {
          const credentials = btoa(
            `${this.config.username}:${this.config.password}`
          );
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout || 30000
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new CustomApiError(
          `Request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof CustomApiError && error.statusCode === 404;
  }

  private arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

export class CustomApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "CustomApiError";
  }
}
