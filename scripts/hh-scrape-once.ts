import "dotenv/config";

import { syncVacanciesFromScrape } from "../src/services/vacancy-scrape-sync.js";
import { prisma } from "../src/db/client.js";

const result = await syncVacanciesFromScrape();

console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();

if (result.errors.length > 0) {
  process.exit(1);
}
