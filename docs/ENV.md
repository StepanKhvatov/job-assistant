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

Остальное — дефолты в `getEnv()` (score, retention, `HH_BASE_URL=https://novosibirsk.hh.ru`).

## Алиасы (старые имена)

| Было | Читается как |
| ---- | ------------ |
| `HH_SCRAPE_KEYWORD` | `HH_SEARCH_KEYWORD` |
| `HH_SCRAPE_BASE_URL` | `HH_BASE_URL` |
| `HH_SCRAPE_DETAIL_DELAY_MS` | `SCRAPE_DELAY_MS` |
| `HH_SCRAPE_HEADLESS` | `HEADLESS` |
| `AI_RANK_LIMIT` | `RANK_LIMIT` |
| `VACANCY_RETENTION_DAYS` | `RETENTION_DAYS` |

## CI (GitHub Actions)

| Переменная | Обязательно | Описание |
| ---------- | ----------- | -------- |
| `HH_AUTH_STATE_B64` | да (в CI) | Base64 `.auth/hh-user.json` — `npm run hh:auth:export` |
| `HH_AUTH_META_B64` | нет | Base64 `.auth/hh-session.meta.json` |

Локально `HH_AUTH_STATE_B64` не нужен — используется `.auth/` после `playwright:auth`.

## Отдельно от pipeline

Добавьте в `.env` только если используете:

| Переменные | Команда |
| ---------- | ------- |
| `HH_USER_AGENT`, `HH_ACCESS_TOKEN`, `HH_KEYWORDS` | `npm run hh:sync` |
| `HH_MAX_PAGES_PER_QUERY`, `HH_MAX_VACANCIES_DETAIL` | только `npm run hh:sync` |
| `HH_VACANCY_ID` | `npm run playwright:apply` |
| `APPLY_MAX_VACANCIES` | `npm run hh:apply` |
| `CRON_SECRET`, `PORT`, `HOST` | `npm run dev` |

## Типизация

[Zod](https://zod.dev) — `requireHhCredentials()`, `requireDeepSeekKey()` для обязательных полей по шагу.

## Дефолты в коде

| Поле | Значение |
| ---- | -------- |
| `HH_BASE_URL` | `https://novosibirsk.hh.ru` |
| `SCRAPE_DELAY_MS` | 800 |
| `RANK_LIMIT` | 10 |
| `APPLY_MIN_SCORE` | 75 |
| `APPLY_MAX_PER_RUN` | 10 |
| `RETENTION_DAYS` | 45 |
