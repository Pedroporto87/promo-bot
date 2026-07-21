import "dotenv/config";

import { getBaileysSocket } from "@/lib/whatsapp-baileys";

getBaileysSocket()
  .then(() => {
    console.log("[baileys] sessão persistente validada.");
    setTimeout(() => process.exit(0), 1_000);
  })
  .catch((error) => {
    console.error("[baileys] sessão inválida:", error);
    process.exit(1);
  });
