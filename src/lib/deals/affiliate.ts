import { getEnv } from "@/lib/env";
import type { SourceConfig } from "@/lib/sources";

/**
 * Appends the affiliate tag to a product URL. The Amazon format (?tag=) is the documented
 * Associates format.
 *
 * The Mercado Livre format is EXPERIMENTAL: their real generated links (via the official
 * "Gerar link" tool) point to a generic /social/{username} path with the actual product
 * encoded in an opaque, server-signed `ref` token we can't reproduce. This appends the same
 * matt_word/matt_tool query params directly to the product URL instead, which may or may not
 * be honored for commission attribution by their backend — verify against the affiliate
 * dashboard before relying on it. If it doesn't attribute, fall back to posting without a
 * Mercado Livre affiliate link.
 */
export function buildAffiliateUrl(url: string, source: SourceConfig): string {
  if (!source.affiliateTag) return url;

  const withTag = new URL(url);

  switch (source.slug) {
    case "amazon":
      withTag.searchParams.set("tag", source.affiliateTag);
      break;
    case "mercadolivre": {
      const mattTool = getEnv("MERCADOLIVRE_MATT_TOOL");
      withTag.searchParams.set("matt_word", source.affiliateTag);
      if (mattTool) withTag.searchParams.set("matt_tool", mattTool);
      break;
    }
  }

  return withTag.toString();
}
