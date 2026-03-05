/**
 * Exchange Rate Service
 *
 * Fetches and caches exchange rates from ExchangeRate-API.
 * Rates are cached for 1 hour to minimize API calls.
 */

interface ExchangeRateResponse {
  result: "success" | "error";
  "error-type"?: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_unix: number;
  time_next_update_unix: number;
}

interface CachedRates {
  baseCurrency: string;
  rates: Record<string, number>;
  fetchedAt: number;
  expiresAt: number;
}

// Cache TTL: 1 hour (rates update daily, so 1 hour is safe)
const CACHE_TTL_MS = 60 * 60 * 1000;

// In-memory cache for exchange rates
const ratesCache = new Map<string, CachedRates>();

/**
 * Get the API token from environment
 */
function getApiToken(): string {
  const token = process.env.EXCHANGERATE_API_TOKEN;
  if (!token) {
    throw new Error("EXCHANGERATE_API_TOKEN environment variable is not set");
  }
  return token;
}

/**
 * Fetch exchange rates from the API
 */
async function fetchExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const apiToken = getApiToken();
  const url = `https://v6.exchangerate-api.com/v6/${apiToken}/latest/${baseCurrency}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ExchangeRate API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ExchangeRateResponse;

  if (data.result === "error") {
    throw new Error(`ExchangeRate API error: ${data["error-type"] || "Unknown error"}`);
  }

  return data.conversion_rates;
}

/**
 * Get exchange rates for a base currency (with caching)
 */
export async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const normalizedBase = baseCurrency.toUpperCase();
  const cached = ratesCache.get(normalizedBase);

  // Return cached rates if still valid
  if (cached && Date.now() < cached.expiresAt) {
    return cached.rates;
  }

  // Fetch fresh rates
  const rates = await fetchExchangeRates(normalizedBase);

  // Cache the rates
  const now = Date.now();
  ratesCache.set(normalizedBase, {
    baseCurrency: normalizedBase,
    rates,
    fetchedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  });

  return rates;
}

/**
 * Convert an amount from one currency to another
 *
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code (ISO 4217)
 * @param toCurrency - Target currency code (ISO 4217)
 * @returns The converted amount
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // No conversion needed if currencies are the same
  if (from === to) {
    return amount;
  }

  // Get rates with the source currency as base
  const rates = await getExchangeRates(from);

  const rate = rates[to];
  if (rate === undefined) {
    throw new Error(`Exchange rate not found for ${from} -> ${to}`);
  }

  return amount * rate;
}

/**
 * Get the exchange rate between two currencies
 *
 * @param fromCurrency - Source currency code (ISO 4217)
 * @param toCurrency - Target currency code (ISO 4217)
 * @returns The exchange rate (multiply by this to convert)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency = rate of 1
  if (from === to) {
    return 1;
  }

  const rates = await getExchangeRates(from);

  const rate = rates[to];
  if (rate === undefined) {
    throw new Error(`Exchange rate not found for ${from} -> ${to}`);
  }

  return rate;
}

/**
 * Clear the exchange rate cache
 * Useful for testing or forcing a refresh
 */
export function clearExchangeRateCache(): void {
  ratesCache.clear();
}

/**
 * Check if the exchange rate API is configured
 */
export function isExchangeRateApiConfigured(): boolean {
  return !!process.env.EXCHANGERATE_API_TOKEN;
}
