# Переменные окружения

Парсер: `src/config/env.ts` (Zod), `getEnv()`.

## `.env` (pipeline)

```env
DATABASE_URL=
DIRECT_URL=
HH_EMAIL=
HH_PASSWORD=
DEEPSEEK_API_KEY=
APPLY_DRY_RUN=true
```

Поисковая фраза — секция **«Поиск на hh.ru»** в `content/candidate-profile.md` (не в `.env`).
Опционально переопределить: `HH_SEARCH_KEYWORD=...`

Остальное — дефолты в `getEnv()` (лимиты страниц, score, retention, `HH_BASE_URL=https://novosibirsk.hh.ru`).

## Алиасы (старые имена)

| Было | Читается как |
| ---- | ------------ |
| `HH_SCRAPE_KEYWORD` | `HH_SEARCH_KEYWORD` |
| `HH_SCRAPE_BASE_URL` | `HH_BASE_URL` |
| `HH_SCRAPE_MAX_PAGES` | `MAX_SEARCH_PAGES` |
| `HH_SCRAPE_MAX_VACANCIES` | `MAX_VACANCIES` |
| `HH_SCRAPE_DETAIL_DELAY_MS` | `SCRAPE_DELAY_MS` |
| `HH_SCRAPE_HEADLESS` | `HEADLESS` |
| `AI_RANK_LIMIT` | `RANK_LIMIT` |
| `VACANCY_RETENTION_DAYS` | `RETENTION_DAYS` |

## Отдельно от pipeline

Добавьте в `.env` только если используете:

| Переменные | Команда |
| ---------- | ------- |
| `HH_USER_AGENT`, `HH_ACCESS_TOKEN`, `HH_KEYWORDS` | `npm run hh:sync` |
| `HH_VACANCY_ID` | `npm run playwright:apply` |
| `CRON_SECRET`, `PORT`, `HOST` | `npm run dev` |

## Типизация

[Zod](https://zod.dev) — `requireHhCredentials()`, `requireDeepSeekKey()` для обязательных полей по шагу.

## Дефолты в коде

| Поле | Значение |
| ---- | -------- |
| `HH_BASE_URL` | `https://novosibirsk.hh.ru` |
| `MAX_SEARCH_PAGES` | 3 |
| `MAX_VACANCIES` | 50 |
| `SCRAPE_DELAY_MS` | 800 |
| `RANK_LIMIT` | 20 |
| `APPLY_MIN_SCORE` | 75 |
| `APPLY_MAX_PER_RUN` | 5 |
| `RETENTION_DAYS` | 45 |
