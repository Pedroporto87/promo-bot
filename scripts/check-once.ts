import "dotenv/config";

import { checkAllSources } from "@/lib/check";

checkAllSources()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[worker] erro na checagem:", error);
    process.exit(1);
  });
