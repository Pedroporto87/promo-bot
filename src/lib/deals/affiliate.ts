import { buildLomadeeAffiliateUrl } from "@/lib/scrapers/lomadee";
import type { SourceConfig } from "@/lib/sources";
import type { RawDeal } from "@/lib/types";

/**
 * Builds the affiliate URL for a deal.
 *
 * Amazon: appends ?tag={affiliateTag} (documented Associates format).
 * Lomadee: generates a tracked short link via the Lomadee shortener API (async).
 */
export async function buildAffiliateUrl(deal: RawDeal, source: SourceConfig): Promise<string> {
  switch (source.slug) {
    case "amazon": {
      if (!source.affiliateTag) return deal.url;
      const withTag = new URL(deal.url);
      withTag.searchParams.set("tag", source.affiliateTag);
      return withTag.toString();
    }
    case "lomadee":
      return buildLomadeeAffiliateUrl(deal);
  }
}
