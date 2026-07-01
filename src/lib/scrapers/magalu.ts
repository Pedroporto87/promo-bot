import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

const DEALS_URL = "https://www.magazineluiza.com.br/oferta-do-dia/";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type RawCard = {
  href: string;
  title: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
};

function extractSku(href: string): string | null {
  return /\/p\/([a-z0-9]+)\//i.exec(href)?.[1] ?? null;
}

function toAbsoluteUrl(href: string): string {
  return href.startsWith("http") ? href : `https://www.magazineluiza.com.br${href}`;
}

/** Scrapes magazineluiza.com.br/oferta-do-dia using price text extraction instead of CSS class selectors. */
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

    // Dismiss LGPD/cookie banner if present
    try {
      await page.click('[data-testid="cookie-notice-accept"], button:has-text("Aceitar")', {
        timeout: 3_000,
      });
    } catch {
      // No banner — continue
    }

    await page.waitForTimeout(4_000);
    await page.mouse.wheel(0, 3_000);
    await page.waitForTimeout(3_000);

    const rawCards: RawCard[] = await page.evaluate(() => {
      // Matches "R$ 1.299,00", "1.299,00", "R$1299,00"
      const PRICE_RE = /R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;

      function extractPricesFromText(text: string): number[] {
        const prices: number[] = [];
        let m: RegExpExecArray | null;
        PRICE_RE.lastIndex = 0;
        while ((m = PRICE_RE.exec(text)) !== null) {
          const val = Number(m[1].replaceAll(".", "").replace(",", "."));
          if (val > 0) prices.push(val);
        }
        return [...new Set(prices)];
      }

      function findCardContainer(anchor: HTMLAnchorElement): Element {
        // Walk up to find the card root: stop at <li>, or at the nearest
        // ancestor that contains exactly one product link (= one card).
        let el: Element = anchor;
        for (let i = 0; i < 8; i++) {
          const parent = el.parentElement;
          if (!parent || parent.tagName === "BODY" || parent.tagName === "UL") break;
          if (parent.tagName === "LI") return parent;
          if (parent.querySelectorAll('a[href*="/p/"]').length === 1) {
            el = parent;
            continue;
          }
          break;
        }
        return el;
      }

      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"]')
      );

      const seen = new Set<string>();
      const results: RawCard[] = [];

      for (const anchor of anchors) {
        const href = anchor.getAttribute("href") ?? "";
        const skuMatch = /\/p\/([a-z0-9]+)\//i.exec(href);
        if (!skuMatch || seen.has(skuMatch[1])) continue;
        seen.add(skuMatch[1]);

        const card = findCardContainer(anchor);
        const img = card.querySelector<HTMLImageElement>("img");

        const title =
          img?.getAttribute("alt")?.trim() ||
          card.querySelector("h2, h3, [class*='title' i], [class*='name' i]")?.textContent?.trim() ||
          null;

        // Extract all BRL prices from the card's full text — no CSS class dependency.
        const prices = extractPricesFromText(card.textContent ?? "");
        // Sort ascending: lowest = current (discounted), highest = original
        prices.sort((a, b) => a - b);

        results.push({
          href,
          title,
          imageUrl: img?.getAttribute("src") ?? img?.dataset["src"] ?? null,
          currentPrice: prices[0] ?? null,
          originalPrice: prices.length > 1 ? (prices.at(-1) ?? null) : null,
        });
      }

      return results;
    });

    const deals: RawDeal[] = [];
    for (const card of rawCards) {
      if (!card.title || !card.currentPrice) continue;

      const sku = extractSku(card.href);
      if (!sku) continue;

      deals.push({
        externalId: sku,
        title: card.title,
        url: toAbsoluteUrl(card.href),
        imageUrl: card.imageUrl,
        currentPrice: card.currentPrice,
        originalPrice: card.originalPrice,
        currency: "BRL",
      });
    }

    console.log(`[magalu] ${deals.length} produtos válidos em ${rawCards.length} cards lidos.`);
    return deals;
  } finally {
    await browser.close();
  }
}
