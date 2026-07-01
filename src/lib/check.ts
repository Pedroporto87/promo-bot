import { buildAffiliateUrl } from "@/lib/deals/affiliate";
import { matchesCategoryFilter } from "@/lib/deals/category-filter";
import { evaluateDiscount } from "@/lib/deals/detect";
import { getLastNotifiedPrice, isDedupActive, markNotified, shouldNotify } from "@/lib/dedup";
import { getEnv } from "@/lib/env";
import { scrapeAmazonDeals } from "@/lib/scrapers/amazon";
import { scrapeMagaluDeals } from "@/lib/scrapers/magalu";
import { SOURCES, type SourceConfig } from "@/lib/sources";
import { sendDealToTelegram } from "@/lib/telegram";
import type { RawDeal } from "@/lib/types";

const SCRAPERS: Record<SourceConfig["slug"], () => Promise<RawDeal[]>> = {
  amazon: scrapeAmazonDeals,
  magalu: scrapeMagaluDeals,
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
    if (!shouldNotify(raw.currentPrice, lastNotifiedPrice)) continue;

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
  if (!getEnv("TELEGRAM_BOT_TOKEN") || !getEnv("TELEGRAM_GROUP_CHAT_ID")) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID não configurados.");
  }

  if (!isDedupActive()) {
    console.warn(
      "[worker] AVISO: REDIS_URL não configurado — dedup DESATIVADO. " +
        "As mesmas promoções serão repostadas a cada execução. " +
        "Configure o secret REDIS_URL no GitHub Actions para corrigir."
    );
  }

  const activeSources = SOURCES.filter((source) => source.isActive);
  console.log(
    `[worker] iniciando checagem de ${activeSources.length} fonte(s): ` +
      `${activeSources.map((s) => s.name).join(", ") || "nenhuma"}.`
  );

  for (const source of activeSources) {
    await checkSource(source);
  }

  console.log("[worker] checagem concluída.");
}
