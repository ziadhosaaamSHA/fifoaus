import { LRUCache } from "lru-cache";

// No-DB version: best-effort idempotency to avoid double role changes when Stripe retries.
// This resets on deploy/restart, which is an accepted limitation in PRD A.
export function createStripeEventDedupeCache() {
  return new LRUCache({
    max: 50_000,
    ttl: 24 * 60 * 60 * 1000
  });
}

