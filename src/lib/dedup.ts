import IORedis from "ioredis";

import type { SourceSlug } from "@/lib/types";

// Deals like "Oferta do Dia" reset daily; 48h is enough to avoid re-posting
// the same listing across consecutive worker runs without growing forever.
const DEDUP_TTL_SECONDS = 60 * 60 * 48;

let client: IORedis | null = null;

function getClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return client;
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

/** Records that we notified about this deal at this price, so we don't repeat it until the price drops further. */
export async function markNotified(
  sourceSlug: SourceSlug,
  externalId: string,
  price: number
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.set(dedupKey(sourceSlug, externalId), String(price), "EX", DEDUP_TTL_SECONDS);
}
