import type { RawDeal } from "@/lib/types";

// Doce Beleza is a Shopify store; its public /products.json endpoint returns the catalog
// with current price + compare_at_price (original), so we get deals via HTTP (no browser).
// Affiliate tracking is added later via the Awin deep link (see deals/affiliate.ts).
const BASE_URL = "https://www.docebeleza.com.br";
const MAX_PAGES = 4;
const PAGE_LIMIT = 250; // Shopify max for products.json

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type ShopifyVariant = { price?: string; compare_at_price?: string | null; available?: boolean };
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  images?: { src: string }[];
  variants?: ShopifyVariant[];
};

export async function fetchDoceBelezaDeals(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    let products: ShopifyProduct[];
    try {
      const res = await fetch(`${BASE_URL}/products.json?limit=${PAGE_LIMIT}&page=${page}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) {
        console.error(`[docebeleza] HTTP ${res.status} na página ${page}`);
        break;
      }
      products = ((await res.json()) as { products?: ShopifyProduct[] }).products ?? [];
    } catch (error) {
      console.error(`[docebeleza] falha ao buscar página ${page}:`, error);
      break;
    }

    if (products.length === 0) break;

    for (const p of products) {
      const variant = p.variants?.[0];
      if (!variant || variant.available === false) continue;

      const currentPrice = Number(variant.price);
      if (!currentPrice || currentPrice <= 0) continue;

      const listPrice = variant.compare_at_price ? Number(variant.compare_at_price) : null;

      deals.push({
        externalId: String(p.id),
        title: p.title,
        url: `${BASE_URL}/products/${p.handle}`,
        imageUrl: p.images?.[0]?.src ?? null,
        currentPrice,
        originalPrice: listPrice && listPrice > currentPrice ? listPrice : null,
        currency: "BRL",
      });
    }

    if (products.length < PAGE_LIMIT) break;
  }

  console.log(`[docebeleza] ${deals.length} produtos mapeados.`);
  return deals;
}
