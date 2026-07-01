import type { SourceConfig } from "@/lib/sources";

/**
 * Builds the affiliate URL for the given source.
 *
 * Amazon: appends ?tag={affiliateTag} to the product URL.
 *
 * Magalu / Magazine Você: replaces the domain with magazinevoce.com.br/{storeName}.
 *   e.g. magazineluiza.com.br/slug/p/sku/cat/sub/
 *     → magazinevoce.com.br/magazinepromoquente40/slug/p/sku/cat/sub/
 */
export function buildAffiliateUrl(url: string, source: SourceConfig): string {
  if (!source.affiliateTag) return url;

  switch (source.slug) {
    case "amazon": {
      const withTag = new URL(url);
      withTag.searchParams.set("tag", source.affiliateTag);
      return withTag.toString();
    }
    case "magalu": {
      const magaluUrl = new URL(url);
      return `https://www.magazinevoce.com.br/${source.affiliateTag}${magaluUrl.pathname}`;
    }
  }
}
