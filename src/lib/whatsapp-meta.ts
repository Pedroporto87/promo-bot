import axios from "axios";

import { getEnv } from "@/lib/env";
import type { EvaluatedDeal } from "@/lib/types";

const DEFAULT_API_VERSION = "v25.0";
const DEFAULT_TEMPLATE_LANGUAGE = "pt_BR";

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toFixed(2).replace(".", ",")}`;
}

function getRecipients(): string[] {
  return (getEnv("WHATSAPP_RECIPIENTS") ?? "")
    .split(",")
    .map((value) => value.replace(/\D/g, ""))
    .filter(Boolean);
}

export function validateMetaConfig() {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_RECIPIENTS",
  ];
  const missing = required.filter((name) => !getEnv(name));

  if (missing.length > 0) {
    throw new Error(`Configuração da Meta ausente: ${missing.join(", ")}.`);
  }
  if (getRecipients().length === 0) {
    throw new Error("WHATSAPP_RECIPIENTS não contém nenhum número válido.");
  }
}

function buildTemplate(deal: EvaluatedDeal, affiliateUrl: string) {
  return {
    name: getEnv("WHATSAPP_TEMPLATE_NAME")!,
    language: {
      code: getEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? DEFAULT_TEMPLATE_LANGUAGE,
    },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: deal.discountPercent.toFixed(0) },
          { type: "text", text: deal.sourceName },
          { type: "text", text: deal.title },
          {
            type: "text",
            text: deal.originalPrice
              ? formatPrice(deal.originalPrice, deal.currency)
              : "preço anterior não informado",
          },
          { type: "text", text: formatPrice(deal.currentPrice, deal.currency) },
          { type: "text", text: affiliateUrl },
        ],
      },
    ],
  };
}

export async function sendDealWithMeta(deal: EvaluatedDeal, affiliateUrl: string) {
  validateMetaConfig();

  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID")!;
  const apiVersion = getEnv("WHATSAPP_API_VERSION") ?? DEFAULT_API_VERSION;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const template = buildTemplate(deal, affiliateUrl);

  const results = await Promise.allSettled(
    getRecipients().map((to) =>
      axios.post(
        url,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template,
        },
        {
          headers: {
            Authorization: `Bearer ${getEnv("WHATSAPP_ACCESS_TOKEN")!}`,
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      )
    )
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length === results.length) {
    throw new AggregateError(
      failures.map((result) => (result as PromiseRejectedResult).reason),
      "Falha ao enviar a promoção para todos os destinatários pela Meta."
    );
  }
  if (failures.length > 0) {
    console.warn(
      `[meta] promoção enviada parcialmente: ${results.length - failures.length}/${results.length} destinatários.`
    );
  }
}
