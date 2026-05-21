import "dotenv/config";

import { cleanupStaleVacancies } from "../src/services/vacancy-retention.js";
import { prisma } from "../src/db/client.js";
import { logInfo } from "../src/utils/log.js";

const result = await cleanupStaleVacancies();

logInfo(`summary ${JSON.stringify(result)}`);

await prisma.$disconnect();
