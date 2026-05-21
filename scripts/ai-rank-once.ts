import "dotenv/config";

import { rankUnanalyzedVacancies } from "../src/services/vacancy-rank.js";
import { prisma } from "../src/db/client.js";
import { logInfo } from "../src/utils/log.js";

const result = await rankUnanalyzedVacancies();

logInfo(`summary ${JSON.stringify(result)}`);

await prisma.$disconnect();

if (result.errors.length > 0) {
  process.exit(1);
}
