import "dotenv/config";

import { checkAllSources } from "@/lib/check";

function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_CHAT_ID) {
    console.error("[worker] TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID não configurados — encerrando.");
    process.exit(1);
  }

  const intervalMinutes = process.env.CHECK_INTERVAL_MINUTES
    ? Number(process.env.CHECK_INTERVAL_MINUTES)
    : 30;
  console.log(`[worker] ativo. checagem a cada ${intervalMinutes} minuto(s).`);

  const runAndLogErrors = () => {
    checkAllSources().catch((error) => console.error("[worker] erro na checagem:", error));
  };

  runAndLogErrors();
  setInterval(runAndLogErrors, intervalMinutes * 60 * 1000);
}

main();
