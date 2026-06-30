import type { SourceConfig } from "@/lib/sources";

/**
 * Appends the affiliate tag to a product URL. The Amazon format (?tag=) is the documented
 * Associates format. The Mercado Livre format is a placeholder — adjust the query param once
 * approved into the affiliate program and its real link format is known.
 */
export function buildAffiliateUrl(url: string, source: SourceConfig): string {
  if (!source.affiliateTag) return url;

  const withTag = new URL(url);

  switch (source.slug) {
    case "amazon":
      withTag.searchParams.set("tag", source.affiliateTag);
      break;
    case "mercadolivre":
      // TODO: confirmar o formato real do link de afiliado assim que aprovado no programa.
      withTag.searchParams.set("matt_tool", source.affiliateTag);
      break;
  }

  return withTag.toString();
}
