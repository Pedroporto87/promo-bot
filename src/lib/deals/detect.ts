import { getEnv } from "@/lib/env";
import type { RawDeal } from "@/lib/types";

const DEFAULT_THRESHOLD = 40;

// Above this, the "original" price is almost certainly a scraping/parsing error (e.g. a per-unit
// reference price mistaken for the list price), not a real deal. Posting a fake "99% OFF" to clients
// destroys trust, so we drop these — real clearances rarely exceed this.
const MAX_PLAUSIBLE_DISCOUNT = 95;

/** Returns the discount percent if the deal has a valid original price and meets the configured threshold, else null. */
export function evaluateDiscount(raw: RawDeal): number | null {
  if (!raw.originalPrice || raw.originalPrice <= raw.currentPrice) return null;

  const discountPercent = ((raw.originalPrice - raw.currentPrice) / raw.originalPrice) * 100;

  if (discountPercent > MAX_PLAUSIBLE_DISCOUNT) {
    console.warn(
      `[detect] desconto implausível (${discountPercent.toFixed(0)}%) descartado — ` +
        `provável erro de preço: "${raw.title}" (de ${raw.originalPrice} por ${raw.currentPrice})`
    );
    return null;
  }

  const rawThreshold = getEnv("DEAL_DISCOUNT_THRESHOLD");
  const threshold = rawThreshold ? Number(rawThreshold) : DEFAULT_THRESHOLD;

  return discountPercent >= threshold ? discountPercent : null;
}
