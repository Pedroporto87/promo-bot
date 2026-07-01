import IORedis from "ioredis";

import { getEnv } from "@/lib/env";
import type { SourceSlug } from "@/lib/types";

// 7 days — long enough that the same deal won't resurface after a Redis expiry
// within a typical promotional campaign cycle.
const DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7;

// Minimum additional price drop (relative) required to re-notify about the same deal.
// e.g. 0.05 = only re-post if the new price is at least 5% lower than the last notified price.
const MIN_PRICE_DROP_RATIO = 0.05;

let client: IORedis | null = null;

function getClient() {
  const url = getEnv("REDIS_URL");
  if (!url) return null;
  if (!client) {
    client = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return client;
}

/** True when a Redis URL is configured, i.e. dedup will actually persist across runs. */
export function isDedupActive(): boolean {
  return getEnv("REDIS_URL") !== null;
}

function dedupKey(sourceSlug: SourceSlug, externalId: string) {
  return `deal:notified:${sourceSlug}:${externalId}`;
}

/** Price we last notified about for this deal, or null if never notified (or Redis unavailable). */
export async function getLastNotifiedPrice(
  sourceSlug: SourceSlug,
  externalId: string
): Promise<number | null> {
  const redis = getClient();
  if (!redis) return null;
  const value = await redis.get(dedupKey(sourceSlug, externalId));
  return value === null ? null : Number(value);
}

/**
 * Returns true if the current price is low enough to warrant a new notification.
 * Requires a minimum drop of MIN_PRICE_DROP_RATIO relative to the last notified price
 * to avoid re-posting the same deal with trivial price fluctuations (e.g. R$0.01 difference).
 */
export function shouldNotify(currentPrice: number, lastNotifiedPrice: number | null): boolean {
  if (lastNotifiedPrice === null) return true;
  return currentPrice <= lastNotifiedPrice * (1 - MIN_PRICE_DROP_RATIO);
}

/** Records that we notified about this deal at this price. Resets the 7-day TTL. */
export async function markNotified(
  sourceSlug: SourceSlug,
  externalId: string,
  price: number
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.set(dedupKey(sourceSlug, externalId), String(price), "EX", DEDUP_TTL_SECONDS);
}
