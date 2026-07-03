import TelegramBot from "node-telegram-bot-api";

import { getEnv } from "@/lib/env";
import type { EvaluatedDeal } from "@/lib/types";

let bot: TelegramBot | null = null;

function getBot() {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  bot ??= new TelegramBot(token);
  return bot;
}

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toFixed(2).replace(".", ",")}`;
}

// Plain text on purpose: titles and affiliate URLs are dynamic/untrusted content that can
// contain characters (e.g. "_" in a tracking param) that break Telegram's Markdown entity parser.
function formatCaption(deal: EvaluatedDeal, affiliateUrl: string) {
  const lines = [`🔥 ${deal.discountPercent.toFixed(0)}% OFF — ${deal.sourceName}`, deal.title, ""];

  if (deal.originalPrice) {
    lines.push(`De: ${formatPrice(deal.originalPrice, deal.currency)}`);
  }
  lines.push(`Por: ${formatPrice(deal.currentPrice, deal.currency)}`, "", affiliateUrl);

  return lines.join("\n");
}

export async function sendDealToTelegram(deal: EvaluatedDeal, affiliateUrl: string) {
  const chatId = getEnv("TELEGRAM_GROUP_CHAT_ID");
  if (!chatId) throw new Error("TELEGRAM_GROUP_CHAT_ID não configurado.");

  const telegram = getBot();
  const caption = formatCaption(deal, affiliateUrl);

  if (deal.imageUrl) {
    try {
      await telegram.sendPhoto(chatId, deal.imageUrl, { caption });
      return;
    } catch (error) {
      // A imagem pode ser inválida para o Telegram (URL retorna HTML/redirect, formato não suportado,
      // arquivo grande demais → "wrong type of the web page content"). Não perdemos a oferta: postamos
      // como texto puro com o link, que é o essencial para a conversão.
      console.warn(
        `[telegram] sendPhoto falhou para "${deal.title}", reenviando como texto:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  await telegram.sendMessage(chatId, caption);
}
