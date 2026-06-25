import "dotenv/config";

import { prisma } from "../src/db/client.js";

const rows = await prisma.vacancy.findMany({
  where: {
    applications: {
      none: {
        status: { in: ["applied", "already_applied", "skipped_foreign_country"] },
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
    `${v.hhId}\tscore=${v.analyses[0]?.score ?? "?"}\t${v.salary ?? "-"}\t${v.title?.slice(0, 70)}`,
  );
}

await prisma.$disconnect();
