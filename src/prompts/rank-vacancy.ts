import { loadRankContent } from "../config/load-content.js";

export type VacancyForRank = {
  provider: string;
  externalId: string;
  title: string;
  company: string | null;
  salary: string | null;
  url: string;
  description: string;
};

export function buildRankVacancyMessages(vacancy: VacancyForRank) {
  const { rankSystem, candidateProfile } = loadRankContent();

  const user = `${candidateProfile}

---

Вакансия:
- provider: ${vacancy.provider}
- id: ${vacancy.externalId}
- Название: ${vacancy.title}
- Компания: ${vacancy.company ?? "не указана"}
- Зарплата: ${vacancy.salary ?? "не указана"}
- URL: ${vacancy.url}

Описание:
${vacancy.description}`;

  return [
    { role: "system" as const, content: rankSystem },
    { role: "user" as const, content: user },
  ];
}
