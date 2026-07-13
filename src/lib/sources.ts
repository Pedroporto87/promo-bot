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
  // Per-source cap of posts per run. Overrides the global MAX_POSTS_PER_RUN.
  // Amazon gets the most (pays better/faster, safer delivery); Awin the least.
  maxPostsPerRun?: number;
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
    // Search is already scoped to the beauty department (i=beauty), so every result fits the niche.
    filterByTitle: false,
    maxPostsPerRun: 60, // única fonte ativa — volume alto p/ compensar promoções momentâneas
  },
  {
    slug: "lomadee",
    name: "Lomadee",
    isActive: activeSlugs.has("lomadee"),
    affiliateTag: getEnv("LOMADEE_API_KEY"),
    filterByTitle: true,
    maxPostsPerRun: 5,
  },
  {
    slug: "docebeleza",
    name: "Doce Beleza",
    isActive: activeSlugs.has("docebeleza"),
    affiliateTag: getEnv("AWIN_PUBLISHER_ID"),
    filterByTitle: false, // loja 100% beleza/cosméticos — tudo já é do nicho
    maxPostsPerRun: 5, // Awin limitado a 5 por run
  },
];
