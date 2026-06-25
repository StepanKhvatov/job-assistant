import { loadCoverLetter, loadRankContent } from "../config/load-content.js";

export type VacancyForCoverLetter = {
  hhId: string;
  title: string;
  company: string | null;
  salary: string | null;
  url: string;
  description: string;
  analysisSummary?: string | null;
};

export function buildCoverLetterMessages(vacancy: VacancyForCoverLetter) {
  const { candidateProfile } = loadRankContent();
  const baseCoverLetter = loadCoverLetter();

  const system = `Ты помогаешь соискателю написать короткое сопроводительное письмо на русском языке.

Требования:
- Письмо должно быть емким, простым и естественным.
- 3-5 коротких предложений, без списков и markdown.
- Без выдуманных фактов и без преувеличений.
- Упоминай только релевантный опыт кандидата под эту вакансию.
- Не пиши общие штампы вроде "прошу рассмотреть мою кандидатуру".
- Не добавляй приветствие и подпись.
- Если в вакансии мало деталей, все равно напиши аккуратное короткое письмо по известному контексту.`;

  const user = `${candidateProfile}

---

Базовый стиль письма:
${baseCoverLetter}

---

Вакансия:
- id: ${vacancy.hhId}
- Название: ${vacancy.title}
- Компания: ${vacancy.company ?? "не указана"}
- Зарплата: ${vacancy.salary ?? "не указана"}
- URL: ${vacancy.url}
- Summary анализа: ${vacancy.analysisSummary ?? "нет"}

Описание вакансии:
${vacancy.description}

Сгенерируй только текст сопроводительного письма.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
