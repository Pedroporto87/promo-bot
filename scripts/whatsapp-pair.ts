import "dotenv/config";

import { Boom } from "@hapi/boom";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "baileys";
import { rm } from "node:fs/promises";
import pino from "pino";
import QRCode from "qrcode";

import { getEnv } from "@/lib/env";

const QR_FILE = ".baileys-pairing-qr.png";
const RECONNECT_DELAY_MS = 1_500;

async function main() {
  const pairingMethod = getEnv("BAILEYS_PAIRING_METHOD")?.toLowerCase() ?? "qr";
  const phoneNumber = getEnv("BAILEYS_PHONE_NUMBER")?.replace(/\D/g, "");
  if (pairingMethod === "code" && !phoneNumber) {
    throw new Error("Configure BAILEYS_PHONE_NUMBER com DDI + DDD + número, somente dígitos.");
  }

  const { state, saveCreds } = await useMultiFileAuthState(
    getEnv("BAILEYS_AUTH_DIR") ?? ".baileys-auth"
  );
  const { version } = await fetchLatestBaileysVersion();
  let finished = false;
  let codeRequested = false;

  const startSocket = async () => {
    const socket = makeWASocket({
      auth: state,
      browser: Browsers.windows("Chrome"),
      version,
      defaultQueryTimeoutMs: undefined,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr && pairingMethod === "qr") {
        await QRCode.toFile(QR_FILE, qr, { width: 700, margin: 3 });
        console.log(`[baileys] QR Code atualizado em ${QR_FILE}.`);
      }

      if (connection === "open" && !finished) {
        finished = true;
        await saveCreds();
        await rm(QR_FILE, { force: true });
        console.log("[baileys] pareamento concluído e sessão salva.");
        setTimeout(() => process.exit(0), 1_000);
      }

      if (connection === "close" && !finished) {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          console.error("[baileys] pareamento recusado ou sessão encerrada.");
          await rm(QR_FILE, { force: true });
          process.exit(1);
        }

        // WhatsApp normally closes with restartRequired (515) immediately after a
        // successful QR scan. Recreating the socket completes the same saved session.
        console.log(`[baileys] reiniciando conexão após código ${statusCode ?? "desconhecido"}...`);
        setTimeout(() => void startSocket(), RECONNECT_DELAY_MS);
      }
    });

    if (!state.creds.registered && pairingMethod === "code" && !codeRequested) {
      codeRequested = true;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const code = await socket.requestPairingCode(phoneNumber!);
      console.log("\nCódigo de pareamento:", code.match(/.{1,4}/g)?.join("-") ?? code);
      console.log(
        "No WhatsApp Business: Configurações > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone.\n"
      );
    }

    return socket;
  };

  if (state.creds.registered) {
    console.log("[baileys] sessão encontrada; confirmando a conexão...");
  } else if (pairingMethod === "qr") {
    console.log(
      "No WhatsApp Business, abra Configurações > Aparelhos conectados > Conectar aparelho e leia o QR Code.\n"
    );
  }

  await startSocket();
}

main().catch((error) => {
  console.error("[baileys] falha no pareamento:", error);
  process.exit(1);
});
