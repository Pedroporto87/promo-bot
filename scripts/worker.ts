import "dotenv/config";

import { checkAllSources } from "@/lib/check";
import { getEnv } from "@/lib/env";

function main() {
  if (!getEnv("TELEGRAM_BOT_TOKEN") || !getEnv("TELEGRAM_GROUP_CHAT_ID")) {
    console.error("[worker] TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID não configurados — encerrando.");
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

main();
