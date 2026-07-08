import type { Page } from "playwright";
import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

// Cosmetics-focused search seeds, all scoped to the beauty department (i=beauty) and already
// discounted (p_n_deal_type). Kérastase (premium) and Korean skincare are explicit targets; the
// generic seeds fill variety. Household cleaning never appears because the search is beauty-only.
const SEARCH_SEEDS = ["kerastase", "skincare coreano", "k-beauty", "cosmeticos", "maquiagem"];

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function searchUrl(seed: string): string {
  return `https://www.amazon.com.br/s?k=${encodeURIComponent(seed)}&i=beauty&rh=p_n_deal_type%3A26908755011`;
}

type RawCard = {
  asin: string | null;
  title: string | null;
  imageUrl: string | null;
  currentLabel: string | null;
  previousLabel: string | null;
};

function parseBrlAmount(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/([\d.,]+)/);
  if (!match) return null;
  const normalized = match[1].replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Scrapes one beauty search page (results load lazily, so a scroll is required). */
async function scrapeSeed(page: Page, seed: string): Promise<RawDeal[]> {
  await page.goto(searchUrl(seed), { timeout: 30_000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_500);
  // JS scroll instead of page.mouse.wheel — the latter throws intermittent
  // "Protocol error (Input.dispatchMouseEvent)" in headless chromium.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(1_000);
  }

  const rawCards: RawCard[] = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div[data-component-type='s-search-result']"));
    return cards.map((card) => {
      const image = card.querySelector<HTMLImageElement>("img.s-image");
      // Current selling price: the a-price that is NOT a text-price (text-price is the struck list
      // price or a per-unit reference). Struck list price: a-price[data-a-strike='true'].
      const current = card.querySelector(".a-price:not(.a-text-price) .a-offscreen");
      const previous = card.querySelector(".a-price[data-a-strike='true'] .a-offscreen");

      return {
        asin: card.getAttribute("data-asin") || null,
        title: card.querySelector("h2")?.textContent?.trim() || image?.getAttribute("alt") || null,
        imageUrl: image?.getAttribute("src") ?? null,
        currentLabel: current?.textContent ?? null,
        previousLabel: previous?.textContent ?? null,
      };
    });
  });

  const deals: RawDeal[] = [];
  for (const card of rawCards) {
    if (!card.asin || !card.title) continue;
    const currentPrice = parseBrlAmount(card.currentLabel);
    if (currentPrice === null) continue;

    deals.push({
      externalId: card.asin,
      title: card.title,
      url: `https://www.amazon.com.br/dp/${card.asin}`,
      imageUrl: card.imageUrl,
      currentPrice,
      originalPrice: parseBrlAmount(card.previousLabel),
      currency: "BRL",
    });
  }

  return deals;
}

/** Round-robin merge across seeds so the post quota spans niches (Kérastase, Korean, makeup...)
 *  instead of being filled by a single seed. Dedups by ASIN, first occurrence wins. */
function interleaveDedup(perSeed: RawDeal[][]): RawDeal[] {
  const seen = new Set<string>();
  const merged: RawDeal[] = [];
  const maxLen = Math.max(0, ...perSeed.map((list) => list.length));

  for (let i = 0; i < maxLen; i++) {
    for (const list of perSeed) {
      const deal = list[i];
      if (!deal || seen.has(deal.externalId)) continue;
      seen.add(deal.externalId);
      merged.push(deal);
    }
  }

  return merged;
}

/** Scrapes amazon.com.br beauty deals across several cosmetics-focused search seeds. */
export async function scrapeAmazonDeals(): Promise<RawDeal[]> {
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });

  try {
    const page = await browser.newPage({
      locale: "pt-BR",
      userAgent: DESKTOP_USER_AGENT,
      viewport: { width: 1366, height: 900 },
    });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const perSeed: RawDeal[][] = [];
    for (const seed of SEARCH_SEEDS) {
      perSeed.push(await scrapeSeed(page, seed));
    }

    return interleaveDedup(perSeed);
  } finally {
    await browser.close();
  }
}
