import "dotenv/config";

import { applyToRankedVacancies } from "../src/services/vacancy-apply-sync.js";
import { prisma } from "../src/db/client.js";
import { logInfo } from "../src/utils/log.js";

logInfo("operation=hh:apply start");
const result = await applyToRankedVacancies();

logInfo(`operation=hh:apply summary ${JSON.stringify(result)}`);

await prisma.$disconnect();

const succeeded = result.applied;
if (result.errors.length > 0 && succeeded === 0) {
  process.exit(1);
}
