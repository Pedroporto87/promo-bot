import "dotenv/config";

import { getWhatsAppProvider } from "@/lib/whatsapp";

async function main() {
  if (getWhatsAppProvider() !== "baileys") {
    throw new Error("O teste seguro requer WHATSAPP_PROVIDER=baileys.");
  }

  const { sendBaileysTestMessage } = await import("@/lib/whatsapp-baileys");
  await sendBaileysTestMessage();
  setTimeout(() => process.exit(0), 1_000);
}

main().catch((error) => {
  console.error("[baileys] falha no teste:", error);
  process.exit(1);
});
