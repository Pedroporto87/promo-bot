import { getEnv } from "@/lib/env";
import type { RawDeal } from "@/lib/types";

// Lomadee affiliate API (new SocialSoul platform). Auth via x-api-key header.
// Docs: https://docs.lomadee.com.br
const BASE_URL = "https://api.lomadee.com.br";

// Cap pages per run so we respect the 60 req/min rate limit and don't run forever.
const MAX_PAGES = 3;
const PAGE_LIMIT = 100;

type LomadeePricing = { listPrice?: number | null; price?: number | null };
type LomadeeOption = { pricing?: LomadeePricing[]; seller?: string };
type LomadeeProduct = {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  available?: boolean;
  images?: { url: string }[];
  options?: LomadeeOption[];
};
type ProductsResponse = { data?: LomadeeProduct[]; count?: number };

function headers(key: string): Record<string, string> {
  return { "x-api-key": key, Accept: "application/json" };
}

/**
 * Fetches available products from the Lomadee affiliate API and maps them to RawDeal.
 * Optionally restricted to specific brands via LOMADEE_ORGANIZATION_IDS (comma-separated
 * brand organization IDs). The title category-filter + discount threshold still apply
 * downstream, so this can safely return a broad set.
 *
 * NOTE: pricing values come back in reais (e.g. 49.99), despite the docs labelling them cents.
 */
export async function fetchLomadeeDeals(): Promise<RawDeal[]> {
  const key = getEnv("LOMADEE_API_KEY");
  if (!key) {
    console.warn("[lomadee] LOMADEE_API_KEY não configurada — pulando fonte Lomadee.");
    return [];
  }

  const orgIds = getEnv("LOMADEE_ORGANIZATION_IDS");
  const deals: RawDeal[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      isAvailable: "true",
      limit: String(PAGE_LIMIT),
      page: String(page),
    });
    if (orgIds) params.set("organizationIds", orgIds);

    const res = await fetch(`${BASE_URL}/affiliate/products?${params.toString()}`, {
      headers: headers(key),
    });
    if (!res.ok) {
      console.error(`[lomadee] falha ao buscar produtos (página ${page}): HTTP ${res.status}`);
      break;
    }

    const body = (await res.json()) as ProductsResponse;
    const products = body.data ?? [];
    if (products.length === 0) break;

    for (const product of products) {
      const pricing = product.options?.[0]?.pricing?.[0];
      const currentPrice = pricing?.price ?? null;
      if (!product.name || !product.url || !currentPrice || currentPrice <= 0) continue;

      const listPrice = pricing?.listPrice ?? null;

      deals.push({
        externalId: product.id,
        title: product.name,
        url: product.url,
        imageUrl: product.images?.[0]?.url ?? null,
        currentPrice,
        originalPrice: listPrice && listPrice > currentPrice ? listPrice : null,
        currency: "BRL",
        organizationId: product.organizationId,
      });
    }

    if (products.length < PAGE_LIMIT) break; // last page
  }

  console.log(`[lomadee] ${deals.length} produtos mapeados.`);
  return deals;
}

type ShortenChannel = { shortUrls?: (string | { url?: string; shortUrl?: string })[] };

/**
 * Turns a product URL into a tracked Lomadee affiliate link via the shortener endpoint.
 * Requires the account to have at least one CHANNEL configured (in the Lomadee panel);
 * with no channel the API returns an empty array and we fall back to the raw product URL
 * (no commission) with a warning.
 */
export async function buildLomadeeAffiliateUrl(deal: RawDeal): Promise<string> {
  const key = getEnv("LOMADEE_API_KEY");
  if (!key || !deal.organizationId) return deal.url;

  try {
    const res = await fetch(`${BASE_URL}/affiliate/shortener/url`, {
      method: "POST",
      headers: { ...headers(key), "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: deal.organizationId,
        type: "Custom",
        url: deal.url,
      }),
    });

    if (!res.ok) {
      console.error(`[lomadee] falha ao gerar link rastreado: HTTP ${res.status}`);
      return deal.url;
    }

    const channels = (await res.json()) as ShortenChannel[];
    for (const channel of channels) {
      const first = channel.shortUrls?.[0];
      if (typeof first === "string") return first;
      if (first?.url) return first.url;
      if (first?.shortUrl) return first.shortUrl;
    }

    console.warn(
      "[lomadee] nenhum canal configurado — postando sem link de afiliado (sem comissão). " +
        "Crie um canal no painel da Lomadee."
    );
    return deal.url;
  } catch (error) {
    console.error("[lomadee] erro ao gerar link rastreado:", error);
    return deal.url;
  }
}
