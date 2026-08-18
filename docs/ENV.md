# Переменные окружения

Парсер: `src/config/env.ts` (Zod), `getEnv()`.

Сессии hh.ru (cookies, не OAuth): [AUTH.md](./AUTH.md).  
Карта HH / LinkedIn: [PROVIDERS.md](./PROVIDERS.md).

## `.env` (pipeline)

```env
DATABASE_URL=
DIRECT_URL=
HH_EMAIL=
HH_PASSWORD=
DEEPSEEK_API_KEY=
```

Поисковая фраза — секция **«Поиск на hh.ru»** в `content/candidate-profile.md` (не в `.env`).
Опционально переопределить: `HH_SEARCH_KEYWORD=...`

Остальное — дефолты в `getEnv()` и в схеме борда (`src/providers/hh.ts`: задержки scrape/apply).

## CI (GitHub Actions)

| Переменная | Обязательно | Описание |
| ---------- | ----------- | -------- |
| `DATABASE_URL` | да | Transaction pooler Supabase (`:6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | да (migrate) | Session pooler (`:5432`) |
| `HH_AUTH_STATE_B64` | да (в CI) | Slim export cookies `*.hh.ru` — `npm run hh:auth:export` |
| `HH_AUTH_META_B64` | нет | Base64 `.auth/hh-session.meta.json` |
| `DEEPSEEK_API_KEY` | да (rank/apply) | Ключ DeepSeek |

Локально `HH_AUTH_STATE_B64` не нужен — используется `.auth/` после `HEADLESS=false npm run playwright:auth`.

Пароль в `DATABASE_URL` с `@` — URL-encode (`%40`). Проверка: `npm run db:check`.

## Отдельно от pipeline

Добавьте в `.env` только если используете:

| Переменные | Команда |
| ---------- | ------- |
| `HH_USER_AGENT`, `HH_ACCESS_TOKEN`, `HH_KEYWORDS` / `HH_SEARCH_TEXT` | `npm run hh:sync` |
| `HH_MAX_PAGES_PER_QUERY`, `HH_MAX_VACANCIES_DETAIL`, `HH_API_BASE_URL` | только `npm run hh:sync` |
| `HH_VACANCY_ID` | `npm run playwright:apply` |
| `HEADLESS=false` | локальный `playwright:auth` (капча) |
| `CRON_SECRET`, `PORT`, `HOST` | `npm run dev` |

Задержки и лимиты (все с дефолтами): `SCRAPE_DELAY_MS`, `APPLY_DELAY_MS`, `APPLY_MIN_SCORE`, `APPLY_MAX_PER_RUN`, `RANK_LIMIT`, `RETENTION_DAYS`. Если не заданы scrape/apply delay — берутся из схемы борда.

## Типизация

[Zod](https://zod.dev) — `requireHhCredentials()`, `requireDeepSeekKey()` для обязательных полей по шагу.

## Дефолты в коде

| Поле | Значение |
| ---- | -------- |
| `HH_BASE_URL` | `https://novosibirsk.hh.ru` |
| `SCRAPE_DELAY_MS` | из схемы борда (HH: 800) |
| `RANK_LIMIT` | `100` |
| `APPLY_MIN_SCORE` | `60` |
| `APPLY_MAX_PER_RUN` | `30` |
| `APPLY_DELAY_MS` | из схемы борда (HH: 3000) |
| `RETENTION_DAYS` | `45` |
| `RETENTION_INLINE` | `true` локально; в CI `false` |
