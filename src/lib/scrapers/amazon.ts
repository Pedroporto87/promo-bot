import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

// Beauty department (i=beauty) already discounted (p_n_deal_type). Scoping the search to the beauty
// index gives a niche-only pool of real deals — far better yield than the generic /deals page (whose
// DOM also drifts). k=beleza just seeds the ranking; the department + deal filter do the real work.
const SEARCH_URL =
  "https://www.amazon.com.br/s?k=beleza&i=beauty&rh=p_n_deal_type%3A26908755011";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

/** Scrapes amazon.com.br beauty search filtered to deals. Results load lazily, so a scroll is required. */
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

    await page.goto(SEARCH_URL, { timeout: 30_000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    // Scroll to lazy-load the full result grid. JS scroll instead of page.mouse.wheel — the latter
    // throws intermittent "Protocol error (Input.dispatchMouseEvent)" in headless chromium.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1600));
      await page.waitForTimeout(1_200);
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
  } finally {
    await browser.close();
  }
}
