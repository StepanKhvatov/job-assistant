import "dotenv/config";

import { syncVacanciesFromScrape } from "../src/services/vacancy-scrape-sync.js";
import { logInfo } from "../src/utils/log.js";
import { prisma } from "../src/db/client.js";

const result = await syncVacanciesFromScrape();

logInfo(`summary ${JSON.stringify(result)}`);

await prisma.$disconnect();

if (result.errors.length > 0) {
  process.exit(1);
}
