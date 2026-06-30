import { getEnv } from "@/lib/env";
import type { RawDeal } from "@/lib/types";

const DEFAULT_THRESHOLD = 40;

/** Returns the discount percent if the deal has a valid original price and meets the configured threshold, else null. */
export function evaluateDiscount(raw: RawDeal): number | null {
  if (!raw.originalPrice || raw.originalPrice <= raw.currentPrice) return null;

  const discountPercent = ((raw.originalPrice - raw.currentPrice) / raw.originalPrice) * 100;
  const rawThreshold = getEnv("DEAL_DISCOUNT_THRESHOLD");
  const threshold = rawThreshold ? Number(rawThreshold) : DEFAULT_THRESHOLD;

  return discountPercent >= threshold ? discountPercent : null;
}
