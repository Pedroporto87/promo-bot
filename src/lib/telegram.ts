import TelegramBot from "node-telegram-bot-api";

import { getEnv } from "@/lib/env";
import type { EvaluatedDeal } from "@/lib/types";

let bot: TelegramBot | null = null;

function getBot() {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  if (!bot) bot = new TelegramBot(token);
  return bot;
}

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toFixed(2).replace(".", ",")}`;
}

function formatCaption(deal: EvaluatedDeal, affiliateUrl: string) {
  const lines = [
    `🔥 *${deal.discountPercent.toFixed(0)}% OFF* — ${deal.sourceName}`,
    `*${deal.title}*`,
    "",
  ];

  if (deal.originalPrice) {
    lines.push(`~${formatPrice(deal.originalPrice, deal.currency)}~`);
  }
  lines.push(`*${formatPrice(deal.currentPrice, deal.currency)}*`, "", affiliateUrl);

  return lines.join("\n");
}

export async function sendDealToTelegram(deal: EvaluatedDeal, affiliateUrl: string) {
  const chatId = getEnv("TELEGRAM_GROUP_CHAT_ID");
  if (!chatId) throw new Error("TELEGRAM_GROUP_CHAT_ID não configurado.");

  const telegram = getBot();
  const caption = formatCaption(deal, affiliateUrl);

  if (deal.imageUrl) {
    await telegram.sendPhoto(chatId, deal.imageUrl, { caption, parse_mode: "Markdown" });
  } else {
    await telegram.sendMessage(chatId, caption, { parse_mode: "Markdown" });
  }
}
