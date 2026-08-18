import "dotenv/config";

import { prisma } from "../src/db/client.js";
import { APPLICATION_NO_RETRY_STATUSES } from "../src/playwright/apply.js";

const rows = await prisma.vacancy.findMany({
  where: {
    provider: "hh",
    applications: {
      none: {
        status: { in: [...APPLICATION_NO_RETRY_STATUSES] },
      },
    },
    analyses: { some: { score: { gte: 75 } } },
    NOT: [
      { salary: { contains: "₸" } },
      { description: { contains: "Астана" } },
      { description: { contains: "Казахстан" } },
    ],
  },
  include: { analyses: { orderBy: { score: "desc" }, take: 1 } },
  take: 15,
});

for (const v of rows) {
  console.log(
    `${v.provider}:${v.externalId}\tscore=${v.analyses[0]?.score ?? "?"}\t${v.salary ?? "-"}\t${v.title?.slice(0, 70)}`,
  );
}

await prisma.$disconnect();
