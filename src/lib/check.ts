import { buildAffiliateUrl } from "@/lib/deals/affiliate";
import { matchesCategoryFilter } from "@/lib/deals/category-filter";
import { evaluateDiscount } from "@/lib/deals/detect";
import { getLastNotifiedPrice, isDedupActive, markNotified, shouldNotify } from "@/lib/dedup";
import { getEnv } from "@/lib/env";
import { scrapeAmazonDeals } from "@/lib/scrapers/amazon";
import { fetchLomadeeDeals } from "@/lib/scrapers/lomadee";
import { SOURCES, type SourceConfig } from "@/lib/sources";
import { sendDealToTelegram } from "@/lib/telegram";
import type { RawDeal } from "@/lib/types";

const SCRAPERS: Record<SourceConfig["slug"], () => Promise<RawDeal[]>> = {
  amazon: scrapeAmazonDeals,
  lomadee: fetchLomadeeDeals,
};

const DEFAULT_MAX_POSTS_PER_RUN = 10;

/** Max deals posted per source per run — spreads content through the day instead of flooding. */
function getMaxPostsPerRun(): number {
  const raw = getEnv("MAX_POSTS_PER_RUN");
  const n = raw ? Number(raw) : DEFAULT_MAX_POSTS_PER_RUN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_POSTS_PER_RUN;
}

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

  const maxPerRun = getMaxPostsPerRun();
  let posted = 0;

  for (const raw of rawDeals) {
    if (posted >= maxPerRun) {
      console.log(`[worker] ${source.name}: limite de ${maxPerRun} posts/execução atingido.`);
      break;
    }

    if (!matchesCategoryFilter(raw.title)) continue;

    const discountPercent = evaluateDiscount(raw);
    if (discountPercent === null) continue;

    const lastNotifiedPrice = await getLastNotifiedPrice(source.slug, raw.externalId);
    if (!shouldNotify(raw.currentPrice, lastNotifiedPrice)) continue;

    const affiliateUrl = await buildAffiliateUrl(raw, source);

    try {
      await sendDealToTelegram(
        { ...raw, discountPercent, sourceSlug: source.slug, sourceName: source.name },
        affiliateUrl
      );
      await markNotified(source.slug, raw.externalId, raw.currentPrice);
      posted++;
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
