export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp in ms
}

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowSeconds * 1000;
      this.store.set(key, { count: 1, resetAt });
      return {
        success: true,
        limit,
        remaining: limit - 1,
        resetTime: Math.ceil(resetAt / 1000),
      };
    }

    if (entry.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetTime: Math.ceil(entry.resetAt / 1000),
      };
    }

    entry.count += 1;
    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      resetTime: Math.ceil(entry.resetAt / 1000),
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clearAll(): Promise<void> {
    this.store.clear();
  }
}

// Global default limiter instance
export const defaultRateLimiter: RateLimiter = new InMemoryRateLimiter();

/**
 * Convenience helper function
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  limiter: RateLimiter = defaultRateLimiter
): Promise<RateLimitResult> {
  return limiter.check(key, limit, windowSeconds);
}
