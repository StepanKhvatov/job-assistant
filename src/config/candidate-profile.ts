/**
 * Профиль кандидата для поиска и будущих этапов (AI).
 * Собрано из резюме; без персональных данных (телефон, email и т.д. не храним).
 */
export const CANDIDATE_PROFILE = {
  /** Целевая роль (как в резюме на hh.ru) */
  targetRole: "Frontend-разработчик",

  /**
   * Ключевые слова по умолчанию для hh.ru, если в .env не заданы HH_KEYWORDS / HH_SEARCH_TEXT.
   * Короткий OR-набор — шире выдача; точнее настраивайте через .env.
   */
  defaultHhKeywords: [
    "Frontend",
    "React",
    "TypeScript",
    "JavaScript",
    "Next.js",
  ] as const,

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
