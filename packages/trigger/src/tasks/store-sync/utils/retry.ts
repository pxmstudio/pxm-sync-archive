/**
 * Retry utilities for handling Shopify API throttling
 */

/**
 * Determines whether an error represents a transient/retryable Shopify error.
 *
 * Includes throttle/rate limit errors (429) and server errors (5xx).
 *
 * @param error - The value to inspect for throttle indications.
 * @returns `true` if `error` is an Error whose message (case-insensitive) contains throttle keywords (429, "throttled", "rate limit", "too many requests") or server error keywords (500, 502, 503, 504); `false` otherwise.
 */
export function isThrottleError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      // Rate limit errors
      message.includes("throttled") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429") ||
      // Server errors (transient)
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("internal server error") ||
      message.includes("bad gateway") ||
      message.includes("service unavailable") ||
      message.includes("gateway timeout")
    );
  }
  return false;
}

export interface ThrottleRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

/**
 * Retry an asynchronous operation on throttle errors using exponential backoff with jitter.
 *
 * @param operation - The async function to execute and potentially retry.
 * @param options - Optional retry configuration.
 * @param options.maxRetries - Maximum number of retry attempts (default: 5).
 * @param options.baseDelayMs - Base delay in milliseconds for exponential backoff (default: 2000).
 * @param options.maxDelayMs - Maximum delay in milliseconds between attempts (default: 60000).
 * @param options.label - Short label used in retry log messages (default: "operation").
 * @returns The value returned by a successful `operation` invocation.
 * @throws Rethrows non-throttle errors immediately; if all retry attempts are exhausted, throws the last encountered error.
 */
export async function withThrottleRetry<T>(
  operation: () => Promise<T>,
  options: ThrottleRetryOptions = {}
): Promise<T> {
  const { maxRetries = 5, baseDelayMs = 2000, maxDelayMs = 60000, label = "operation" } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Only retry on throttle errors
      if (!isThrottleError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      console.log(
        `[Throttle] ${label} throttled, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}