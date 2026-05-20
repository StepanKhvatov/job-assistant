export const envSchema = {
  type: "object",
  required: ["DATABASE_URL"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "number", default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },
    DATABASE_URL: { type: "string" },
    DIRECT_URL: { type: "string" },
    CRON_SECRET: { type: "string" },
    /** Полная строка поиска hh.ru (если задана — имеет приоритет над HH_KEYWORDS) */
    HH_SEARCH_TEXT: { type: "string", default: "" },
    /** Ключевые слова через запятую → OR-запрос в hh.ru */
    HH_KEYWORDS: { type: "string", default: "" },
    HH_BASE_URL: { type: "string", default: "https://api.hh.ru" },
    /** Обязательно для hh.ru: контакт в User-Agent (email в скобках) */
    HH_USER_AGENT: { type: "string", default: "" },
    /** Токен приложения: https://dev.hh.ru/admin → ваше приложение → access_token */
    HH_ACCESS_TOKEN: { type: "string", default: "" },
    HH_MAX_PAGES_PER_QUERY: { type: "string", default: "5" },
    HH_DETAIL_DELAY_MS: { type: "string", default: "350" },
    /** "false" — не искать офлайн в Новосибирске */
    HH_INCLUDE_OFFICE: { type: "string", default: "true" },
    /** "false" — не искать удалёнку по России */
    HH_INCLUDE_REMOTE: { type: "string", default: "true" },
    /** Сколько вакансий максимум подтянуть с полным описанием за один sync (остальные пропускаются) */
    HH_MAX_VACANCIES_DETAIL: { type: "string", default: "200" },
  },
} as const;
