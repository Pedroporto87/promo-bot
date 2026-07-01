import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

const DEALS_URL = "https://www.magazineluiza.com.br/oferta-do-dia/";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type RawCard = {
  href: string;
  title: string | null;
  imageUrl: string | null;
  currentLabel: string | null;
  previousLabel: string | null;
};

function parseBrlAmount(label: string | null): number | null {
  if (!label) return null;
  // Handles "R$ 1.299,00", "1.299,00", "1299,00"
  const match = label.replace(/\s/g, "").match(/([\d.,]+)/);
  if (!match) return null;
  const normalized = match[1].replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractSku(href: string): string | null {
  // Magalu product URLs: /slug/p/{sku}/category/subcategory/
  const match = href.match(/\/p\/([a-z0-9]+)\//i);
  return match ? match[1] : null;
}

function toAbsoluteUrl(href: string): string {
  return href.startsWith("http") ? href : `https://www.magazineluiza.com.br${href}`;
}

/** Scrapes magazineluiza.com.br/oferta-do-dia. Products load lazily, so a scroll is performed before reading. */
export async function scrapeMagaluDeals(): Promise<RawDeal[]> {
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
      // All Magalu product links contain /p/{sku}/ — use that as the anchor point.
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"]')
      );

      const seen = new Set<string>();
      const results: RawCard[] = [];

      for (const anchor of anchors) {
        const href = anchor.getAttribute("href") ?? "";
        const skuMatch = href.match(/\/p\/([a-z0-9]+)\//i);
        if (!skuMatch || seen.has(skuMatch[1])) continue;
        seen.add(skuMatch[1]);

        const img = anchor.querySelector<HTMLImageElement>("img");

        // Title: image alt is the most reliable source on Magalu cards
        const title =
          img?.getAttribute("alt")?.trim() ||
          anchor.querySelector("h2, h3, [class*='title' i]")?.textContent?.trim() ||
          anchor.getAttribute("aria-label")?.trim() ||
          null;

        // Collect all leaf-level price text nodes inside the card
        const priceEls = Array.from(
          anchor.querySelectorAll("[class*='price' i], [class*='Price'], [data-testid*='price' i]")
        ).filter((el) => el.children.length === 0);

        const priceLabels = priceEls
          .map((el) => el.textContent?.trim() ?? "")
          .filter((t) => /\d{2,}/.test(t)); // must contain at least 2 consecutive digits

        results.push({
          href,
          title,
          imageUrl: img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? null,
          // On Magalu cards the discounted price comes before the original (struck-through) price
          currentLabel: priceLabels[0] ?? null,
          previousLabel: priceLabels[1] ?? null,
        });
      }

      return results;
    });

    const deals: RawDeal[] = [];
    for (const card of rawCards) {
      if (!card.title) continue;

      const sku = extractSku(card.href);
      if (!sku) continue;

      const currentPrice = parseBrlAmount(card.currentLabel);
      if (!currentPrice) continue;

      deals.push({
        externalId: sku,
        title: card.title,
        url: toAbsoluteUrl(card.href),
        imageUrl: card.imageUrl,
        currentPrice,
        originalPrice: parseBrlAmount(card.previousLabel),
        currency: "BRL",
      });
    }

    console.log(`[magalu] ${deals.length} produtos encontrados em ${rawCards.length} cards lidos.`);
    return deals;
  } finally {
    await browser.close();
  }
}
