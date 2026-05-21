import "dotenv/config";

import { prisma } from "../src/db/client.js";

const vacancy = await prisma.vacancy.findFirst({
  include: {
    analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    _count: { select: { analyses: true, applications: true } },
  },
});

if (!vacancy) {
  console.log("[job-assistant] db verify: no vacancies yet (schema OK if migrate applied)");
  await prisma.$disconnect();
  process.exit(0);
}

const sample = vacancy.analyses[0];
console.log(
  JSON.stringify(
    {
      ok: true,
      vacancy: {
        id: vacancy.id,
        hhId: vacancy.hhId,
        title: vacancy.title,
      },
      relation: {
        analysesCount: vacancy._count.analyses,
        applicationsCount: vacancy._count.applications,
        latestAnalysis: sample
          ? {
              id: sample.id,
              vacancyId: sample.vacancyId,
              vacancyIdMatchesParent: sample.vacancyId === vacancy.id,
              score: sample.score,
            }
          : null,
      },
      hint: "FK analyses.vacancy_id → vacancies.id (not hh_id). Supabase Studio: refresh schema.",
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
