import { chromium } from "playwright";

import type { RawDeal } from "@/lib/types";

const OFFERS_URL = "https://www.mercadolivre.com.br/ofertas";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type RawCard = {
  title: string | null;
  url: string | null;
  imageUrl: string | null;
  currentLabel: string | null;
  previousLabel: string | null;
};

function parseMoneyLabel(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)\s*reais?(?:\s*com\s*(\d+)\s*centavos?)?/i);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = match[2] ? Number(match[2]) : 0;
  return whole + cents / 100;
}

function extractExternalId(url: string): string | null {
  const match = url.match(/\/p\/(MLB\d+)/);
  return match ? match[1] : null;
}

/** Scrapes mercadolivre.com.br/ofertas — their public search API now blocks anonymous/datacenter requests with a 403. */
export async function scrapeMercadoLivreDeals(): Promise<RawDeal[]> {
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

    await page.goto(OFFERS_URL, { timeout: 30_000, waitUntil: "domcontentloaded" });
    await page.waitForSelector(".poly-card", { timeout: 15_000 }).catch(() => null);

    const rawCards: RawCard[] = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".poly-card"));
      return cards.map((card) => {
        const link = card.querySelector<HTMLAnchorElement>(".poly-component__title");
        const image = card.querySelector<HTMLImageElement>(".poly-component__picture");
        const current = card.querySelector(".poly-price__current .andes-money-amount");
        const previous = card.querySelector("s.poly-price__previous");

        return {
          title: link?.textContent?.trim() ?? null,
          url: link?.href ?? null,
          imageUrl: image?.getAttribute("src") ?? null,
          currentLabel: current?.getAttribute("aria-label") ?? null,
          previousLabel: previous?.getAttribute("aria-label") ?? null,
        };
      });
    });

    const deals: RawDeal[] = [];
    for (const card of rawCards) {
      if (!card.title || !card.url) continue;

      const externalId = extractExternalId(card.url);
      const currentPrice = parseMoneyLabel(card.currentLabel);
      if (!externalId || currentPrice === null) continue;

      deals.push({
        externalId,
        title: card.title,
        url: card.url.split("?")[0],
        imageUrl: card.imageUrl,
        currentPrice,
        originalPrice: parseMoneyLabel(card.previousLabel),
        currency: "BRL",
      });
    }

    return deals;
  } finally {
    await browser.close();
  }
}
