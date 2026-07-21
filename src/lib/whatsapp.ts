import { getEnv } from "@/lib/env";
import type { EvaluatedDeal } from "@/lib/types";

export type WhatsAppProvider = "baileys" | "meta";

export function getWhatsAppProvider(): WhatsAppProvider {
  return getEnv("WHATSAPP_PROVIDER")?.toLowerCase() === "meta" ? "meta" : "baileys";
}

export async function validateWhatsAppConfig() {
  if (getWhatsAppProvider() === "meta") {
    const { validateMetaConfig } = await import("@/lib/whatsapp-meta");
    validateMetaConfig();
    return;
  }

  const { validateBaileysConfig } = await import("@/lib/whatsapp-baileys");
  validateBaileysConfig();
}

export async function sendDealToWhatsApp(deal: EvaluatedDeal, affiliateUrl: string) {
  if (getWhatsAppProvider() === "meta") {
    const { sendDealWithMeta } = await import("@/lib/whatsapp-meta");
    return sendDealWithMeta(deal, affiliateUrl);
  }

  const { sendDealWithBaileys } = await import("@/lib/whatsapp-baileys");
  return sendDealWithBaileys(deal, affiliateUrl);
}
