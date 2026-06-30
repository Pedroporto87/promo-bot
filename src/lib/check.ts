import { buildAffiliateUrl } from "@/lib/deals/affiliate";
import { matchesCategoryFilter } from "@/lib/deals/category-filter";
import { evaluateDiscount } from "@/lib/deals/detect";
import { getLastNotifiedPrice, markNotified } from "@/lib/dedup";
import { scrapeAmazonDeals } from "@/lib/scrapers/amazon";
import { scrapeMercadoLivreDeals } from "@/lib/scrapers/mercadolivre";
import { SOURCES, type SourceConfig } from "@/lib/sources";
import { sendDealToTelegram } from "@/lib/telegram";
import type { RawDeal } from "@/lib/types";

const SCRAPERS: Record<SourceConfig["slug"], () => Promise<RawDeal[]>> = {
  amazon: scrapeAmazonDeals,
  mercadolivre: scrapeMercadoLivreDeals,
};

async function checkSource(source: SourceConfig) {
  console.log(`[worker] checando ${source.name}...`);

  let rawDeals: RawDeal[];
  try {
    rawDeals = await SCRAPERS[source.slug]();
  } catch (error) {
    console.error(`[worker] falha ao raspar ${source.name}:`, error);
    return;
  }

  console.log(`[worker] ${source.name}: ${rawDeals.length} produtos encontrados.`);

  for (const raw of rawDeals) {
    if (!matchesCategoryFilter(raw.title)) continue;

    const discountPercent = evaluateDiscount(raw);
    if (discountPercent === null) continue;

    const lastNotifiedPrice = await getLastNotifiedPrice(source.slug, raw.externalId);
    if (lastNotifiedPrice !== null && raw.currentPrice >= lastNotifiedPrice) continue;

    const affiliateUrl = buildAffiliateUrl(raw.url, source);

    try {
      await sendDealToTelegram(
        { ...raw, discountPercent, sourceSlug: source.slug, sourceName: source.name },
        affiliateUrl
      );
      await markNotified(source.slug, raw.externalId, raw.currentPrice);
      console.log(`[worker] postado: ${raw.title} (${discountPercent.toFixed(0)}% off)`);
    } catch (error) {
      console.error(`[worker] falha ao postar no Telegram (${raw.title}):`, error);
    }
  }
}

export async function checkAllSources() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID não configurados.");
  }

  const activeSources = SOURCES.filter((source) => source.isActive);
  console.log(`[worker] iniciando checagem de ${activeSources.length} fonte(s)...`);

  for (const source of activeSources) {
    await checkSource(source);
  }

  console.log("[worker] checagem concluída.");
}
