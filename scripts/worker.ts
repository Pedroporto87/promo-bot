import "dotenv/config";

import { checkAllSources } from "@/lib/check";
import { getEnv } from "@/lib/env";
import { validateWhatsAppConfig } from "@/lib/whatsapp";

async function main() {
  try {
    await validateWhatsAppConfig();
  } catch (error) {
    console.error("[worker] WhatsApp não configurado — encerrando:", error);
    process.exit(1);
  }

  const rawInterval = getEnv("CHECK_INTERVAL_MINUTES");
  const intervalMinutes = rawInterval ? Number(rawInterval) : 30;
  console.log(`[worker] ativo. checagem a cada ${intervalMinutes} minuto(s).`);

  const runAndLogErrors = () => {
    checkAllSources().catch((error) => console.error("[worker] erro na checagem:", error));
  };

  runAndLogErrors();
  setInterval(runAndLogErrors, intervalMinutes * 60 * 1000);
}

main().catch((error) => {
  console.error("[worker] falha ao iniciar:", error);
  process.exit(1);
});
