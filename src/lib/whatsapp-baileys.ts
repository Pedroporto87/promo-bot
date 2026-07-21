import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WASocket,
} from "baileys";
import { Boom } from "@hapi/boom";
import { existsSync, readFileSync } from "node:fs";
import pino from "pino";

import { getEnv } from "@/lib/env";
import type { EvaluatedDeal } from "@/lib/types";

const DEFAULT_AUTH_DIR = ".baileys-auth";
const DEFAULT_SEND_DELAY_MS = 3_000;
const CONNECTION_TIMEOUT_MS = 30_000;
const GROUP_STATE_FILE = ".baileys-group.json";

let socketPromise: Promise<WASocket> | null = null;

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toFixed(2).replace(".", ",")}`;
}

function formatMessage(deal: EvaluatedDeal, affiliateUrl: string) {
  const lines = [`🔥 ${deal.discountPercent.toFixed(0)}% OFF — ${deal.sourceName}`, deal.title, ""];
  if (deal.originalPrice) lines.push(`De: ${formatPrice(deal.originalPrice, deal.currency)}`);
  lines.push(`Por: ${formatPrice(deal.currentPrice, deal.currency)}`, "", affiliateUrl);
  return lines.join("\n");
}

export function getBaileysRecipients(): string[] {
  if (existsSync(GROUP_STATE_FILE)) {
    try {
      const group = JSON.parse(readFileSync(GROUP_STATE_FILE, "utf8")) as { jid?: string };
      if (group.jid?.endsWith("@g.us")) return [group.jid];
    } catch {
      console.warn("[baileys] estado do grupo inválido; usando WHATSAPP_RECIPIENTS.");
    }
  }

  return (getEnv("WHATSAPP_RECIPIENTS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (value.endsWith("@g.us")) return value;
      const digits = value.replace(/\D/g, "");
      return digits ? jidNormalizedUser(`${digits}@s.whatsapp.net`) : "";
    })
    .filter(Boolean);
}

export function validateBaileysConfig() {
  if (!getEnv("WHATSAPP_RECIPIENTS")) {
    throw new Error("WHATSAPP_RECIPIENTS não configurado.");
  }
  if (getBaileysRecipients().length === 0) {
    throw new Error("WHATSAPP_RECIPIENTS não contém nenhum destinatário válido.");
  }
}

async function connect(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(
    getEnv("BAILEYS_AUTH_DIR") ?? DEFAULT_AUTH_DIR
  );
  // Some Baileys/WhatsApp combinations persist `registered: false` after the
  // mandatory 515 restart even though `me` and account keys are already linked.
  // `me` is the reliable indicator that this local state belongs to a paired device.
  if (!state.creds.registered && !state.creds.me) {
    throw new Error("Baileys ainda não pareado. Execute: npm run whatsapp:pair");
  }

  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    auth: state,
    browser: Browsers.windows("Chrome"),
    version,
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  socket.ev.on("creds.update", saveCreds);

  return new Promise<WASocket>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tempo esgotado ao conectar ao WhatsApp.")), CONNECTION_TIMEOUT_MS);

    socket.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        clearTimeout(timer);
        console.log("[baileys] WhatsApp conectado.");
        resolve(socket);
      }
      if (connection === "close") {
        clearTimeout(timer);
        socketPromise = null;
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const message =
          statusCode === DisconnectReason.loggedOut
            ? "Sessão encerrada pelo WhatsApp. Pareie novamente."
            : `Conexão encerrada (código ${statusCode ?? "desconhecido"}).`;
        reject(new Error(message));
      }
    });
  });
}

export function getBaileysSocket() {
  socketPromise ??= connect().catch((error) => {
    socketPromise = null;
    throw error;
  });
  return socketPromise;
}

function getSendDelay() {
  const configured = Number(getEnv("BAILEYS_SEND_DELAY_MS"));
  return Number.isFinite(configured) && configured >= 1_000
    ? configured
    : DEFAULT_SEND_DELAY_MS;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendDealWithBaileys(deal: EvaluatedDeal, affiliateUrl: string) {
  validateBaileysConfig();
  const socket = await getBaileysSocket();
  const message = formatMessage(deal, affiliateUrl);
  const recipients = getBaileysRecipients();
  const failures: unknown[] = [];

  for (const [index, recipient] of recipients.entries()) {
    try {
      if (deal.imageUrl) {
        try {
          await socket.sendMessage(recipient, { image: { url: deal.imageUrl }, caption: message });
        } catch (error) {
          console.warn(`[baileys] imagem falhou no destinatário ${index + 1}; enviando texto:`, error);
          await socket.sendMessage(recipient, { text: message });
        }
      } else {
        await socket.sendMessage(recipient, { text: message });
      }
    } catch (error) {
      failures.push(error);
      console.error(`[baileys] falha no destinatário ${index + 1}:`, error);
    }

    if (index < recipients.length - 1) await wait(getSendDelay());
  }

  if (failures.length === recipients.length) {
    throw new AggregateError(failures, "Falha ao enviar para todos os destinatários pelo Baileys.");
  }
}

export async function sendBaileysTestMessage() {
  validateBaileysConfig();
  const socket = await getBaileysSocket();
  const recipient = getBaileysRecipients()[0];
  await socket.sendMessage(recipient, {
    text: "✅ Teste concluído: o robô de promoções está conectado ao WhatsApp Business.",
  });
  console.log("[baileys] mensagem de teste enviada ao primeiro destinatário.");
}
