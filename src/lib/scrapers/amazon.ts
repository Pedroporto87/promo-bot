import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

const DEALS_URL = "https://www.amazon.com.br/deals";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type RawCard = {
  href: string | null;
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

function extractAsin(href: string): string | null {
  const match = href.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

/** Scrapes amazon.com.br/deals (Ofertas do Dia). Cards load lazily, so a scroll is required before reading the DOM. */
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

    await page.goto(DEALS_URL, { timeout: 30_000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4_000);
    await page.mouse.wheel(0, 3_000);
    await page.waitForTimeout(3_000);

    const rawCards: RawCard[] = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.dcl-product"));
      return cards.map((card) => {
        const link = card.querySelector<HTMLAnchorElement>("a.dcl-product-link");
        const image = card.querySelector<HTMLImageElement>("img.dcl-dynamic-image");
        const current = card.querySelector(".dcl-product-price-new .a-offscreen");
        const previous = card.querySelector(".dcl-product-price-old .a-offscreen");

        return {
          href: link?.getAttribute("href") ?? null,
          title: image?.getAttribute("alt") ?? null,
          imageUrl: image?.getAttribute("src") ?? null,
          currentLabel: current?.textContent ?? null,
          previousLabel: previous?.textContent ?? null,
        };
      });
    });

    const deals: RawDeal[] = [];
    for (const card of rawCards) {
      if (!card.href || !card.title) continue;

      const asin = extractAsin(card.href);
      const currentPrice = parseBrlAmount(card.currentLabel);
      if (!asin || currentPrice === null) continue;

      deals.push({
        externalId: asin,
        title: card.title,
        url: `https://www.amazon.com.br/dp/${asin}`,
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
