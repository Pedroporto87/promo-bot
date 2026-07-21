import "dotenv/config";

import { writeFile } from "node:fs/promises";

import {
  getBaileysRecipients,
  getBaileysSocket,
  validateBaileysConfig,
} from "@/lib/whatsapp-baileys";
import { getEnv } from "@/lib/env";

const GROUP_STATE_FILE = ".baileys-group.json";

async function main() {
  validateBaileysConfig();
  const subject = getEnv("BAILEYS_GROUP_NAME") ?? "Promoções Amazon";
  const participants = getBaileysRecipients().filter((jid) => !jid.endsWith("@g.us"));
  if (participants.length === 0) {
    throw new Error("Configure ao menos um telefone individual em WHATSAPP_RECIPIENTS.");
  }

  const socket = await getBaileysSocket();
  const groups = await socket.groupFetchAllParticipating();
  const existing = Object.values(groups).find((group) => group.subject === subject);
  const group = existing ?? (await socket.groupCreate(subject, participants));

  await writeFile(
    GROUP_STATE_FILE,
    JSON.stringify({ jid: group.id, subject, createdAt: new Date().toISOString() }, null, 2),
    "utf8"
  );

  if (existing) {
    console.log(`[baileys] grupo existente selecionado: ${subject}.`);
  } else {
    console.log(`[baileys] grupo criado: ${subject}.`);
  }
  console.log(`[baileys] destino salvo em ${GROUP_STATE_FILE}.`);
  setTimeout(() => process.exit(0), 1_000);
}

main().catch((error) => {
  console.error("[baileys] falha ao criar o grupo:", error);
  process.exit(1);
});
