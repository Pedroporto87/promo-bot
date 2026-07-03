import { getEnv } from "@/lib/env";
import { buildLomadeeAffiliateUrl } from "@/lib/scrapers/lomadee";
import type { SourceConfig } from "@/lib/sources";
import type { RawDeal } from "@/lib/types";

// Awin advertiser (merchant) id for Doce Beleza.
const AWIN_MID_DOCEBELEZA = "76888";

/**
 * Builds the affiliate URL for a deal.
 *
 * Amazon: appends ?tag={affiliateTag} (documented Associates format).
 * Lomadee: generates a tracked short link via the Lomadee shortener API (async).
 * Doce Beleza: wraps the product URL in an Awin deep link (cread.php) with the publisher id.
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
    case "docebeleza": {
      const affid = getEnv("AWIN_PUBLISHER_ID");
      if (!affid) return deal.url;
      return `https://www.awin1.com/cread.php?awinmid=${AWIN_MID_DOCEBELEZA}&awinaffid=${affid}&ued=${encodeURIComponent(deal.url)}`;
    }
  }
}
