import { getEnv } from "@/lib/env";
import type { SourceSlug } from "@/lib/types";

export type SourceConfig = {
  slug: SourceSlug;
  name: string;
  isActive: boolean;
  affiliateTag: string | null;
  // Apply the title category-filter? False for curated single-niche sources
  // (e.g. a beauty-only store) where every product already fits the niche.
  filterByTitle: boolean;
};

function parseActiveSources(): Set<SourceSlug> {
  const raw = getEnv("ACTIVE_SOURCES");
  if (!raw) return new Set<SourceSlug>(["amazon", "lomadee", "docebeleza"]);
  return new Set(raw.split(",").map((s) => s.trim()) as SourceSlug[]);
}

const activeSlugs = parseActiveSources();

export const SOURCES: SourceConfig[] = [
  {
    slug: "amazon",
    name: "Amazon",
    isActive: activeSlugs.has("amazon"),
    affiliateTag: getEnv("AMAZON_AFFILIATE_TAG"),
    filterByTitle: true,
  },
  {
    slug: "lomadee",
    name: "Lomadee",
    isActive: activeSlugs.has("lomadee"),
    affiliateTag: getEnv("LOMADEE_API_KEY"),
    filterByTitle: true,
  },
  {
    slug: "docebeleza",
    name: "Doce Beleza",
    isActive: activeSlugs.has("docebeleza"),
    affiliateTag: getEnv("AWIN_PUBLISHER_ID"),
    filterByTitle: false, // loja 100% beleza/cosméticos — tudo já é do nicho
  },
];
