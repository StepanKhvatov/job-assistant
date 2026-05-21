/**
 * Константы для кода (поиск hh.ru).
 * Текст для AI-ранжирования — в `content/candidate-profile.md` и `content/rank-system.md`.
 */
export const CANDIDATE_PROFILE = {
  /** Целевая роль (как в резюме на hh.ru) */
  targetRole: "Frontend-разработчик",

  /**
   * Фраза для Playwright-поиска (`?text=`), если не задан HH_SCRAPE_KEYWORD / HH_SEARCH_TEXT.
   * Пробелы и кириллица — как в строке поиска на сайте («Frontend разработчик»).
   */
  defaultScrapeKeyword: "Frontend разработчик",

  /**
   * Ключевые слова по умолчанию для hh.ru API, если в .env не заданы HH_KEYWORDS / HH_SEARCH_TEXT.
   * Короткий OR-набор — шире выдача; точнее настраивайте через .env.
   */
  defaultHhKeywords: ["Frontend", "React", "TypeScript", "JavaScript", "Next.js"] as const,

  /**
   * Навыки из блока «Навыки» резюме (для промптов DeepSeek и т.п.).
   */
  skills: [
    "TypeScript",
    "HTML",
    "CSS",
    "Git",
    "Redux",
    "React",
    "Node.js",
    "JavaScript",
    "Next.js",
    "Tailwind CSS",
    "React.js",
    "Postman",
    "SSR",
    "Strapi",
    "SEO",
    "Cypress",
    "Playwright",
    "Jest",
    "Vercel",
    "GitLab CI",
    "Storybook",
    "SPA",
  ] as const,
} as const;
