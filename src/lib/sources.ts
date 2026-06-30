import { getEnv } from "@/lib/env";
import type { SourceSlug } from "@/lib/types";

export type SourceConfig = {
  slug: SourceSlug;
  name: string;
  isActive: boolean;
  affiliateTag: string | null;
};

function parseActiveSources(): Set<SourceSlug> {
  const raw = getEnv("ACTIVE_SOURCES");
  if (!raw) return new Set<SourceSlug>(["amazon", "mercadolivre"]);
  return new Set(raw.split(",").map((s) => s.trim()) as SourceSlug[]);
}

const activeSlugs = parseActiveSources();

export const SOURCES: SourceConfig[] = [
  {
    slug: "amazon",
    name: "Amazon",
    isActive: activeSlugs.has("amazon"),
    affiliateTag: getEnv("AMAZON_AFFILIATE_TAG"),
  },
  {
    slug: "mercadolivre",
    name: "Mercado Livre",
    isActive: activeSlugs.has("mercadolivre"),
    affiliateTag: getEnv("MERCADOLIVRE_AFFILIATE_TAG"),
  },
];
