# Мастер-схемы сервисов

Источник правды в коде: `src/providers/`. Этот документ — человеческая карта того же контракта.

Общий конвейер не зависит от борда:

```text
auth (cookies) → scrape (борда) → vacancies → rank (общий) → apply (борда)
```

Ранжирование (`npm run ai:rank`) одно на все сервисы. В БД вакансия — `provider` + `external_id`, не `hhId`.

## HeadHunter — active

Файл: `src/providers/hh.ts`.

```text
playwright:auth  →  .auth/hh-user.json
       ↓
hh:auth:check    →  GET /applicant/vacancies  (не login, не captcha)
       ↓
hh:scrape        →  /search/vacancy?text=…&area=113  →  /vacancy/{id}  →  vacancies (provider=hh, external_id)
       ↓
ai:rank          →  analyses.score
       ↓
hh:apply         →  кнопка «Откликнуться»  →  applications.status
```

| | |
| --- | --- |
| Сайт | `HH_BASE_URL`, дефолт `https://novosibirsk.hh.ru` |
| Логин | `{base}/account/login` |
| Проба сессии | `{base}/applicant/vacancies` |
| Поиск | `{base}/search/vacancy?text=&search_field=name&items_on_page=50&area=113` |
| Карточка | `{base}/vacancy/{id}` |
| Сессия | `.auth/hh-user.json`, `.auth/hh-session.meta.json` |
| CI secrets | `HH_AUTH_STATE_B64`, `HH_AUTH_META_B64` |
| Id в БД | `provider=hh` + `external_id` (unique вместе) |
| Отклик через API | нет (соискательский API закрыт) |
| Запасной сбор | `npm run hh:sync` + `HH_ACCESS_TOKEN` (без откликов) |

Команды: `playwright:auth`, `hh:auth:check`, `hh:auth:export`, `hh:scrape`, `hh:apply`, `hh:pipeline`.

Обновление сессии: [AUTH.md](./AUTH.md).

## LinkedIn Jobs — planned

Файл: `src/providers/linkedin.ts`. Рантайма нет.

```text
(будущий) playwright:auth:linkedin  →  .auth/linkedin-user.json
       ↓
проба /feed/                        →  не /login, не /checkpoint/, не /challenge/
       ↓
jobs/search                         →  /jobs/view/{id}  →  vacancies (provider=linkedin, external_id)
       ↓
ai:rank                             →  тот же DeepSeek
       ↓
apply                               →  только Easy Apply; внешний ATS = skip
```

| | |
| --- | --- |
| Сайт | `https://www.linkedin.com` |
| Логин | `/login` |
| Проба сессии | `/feed/` |
| Поиск | `/jobs/search/?keywords=…` |
| Карточка | `/jobs/view/{id}` |
| Сессия (план) | `.auth/linkedin-user.json`, `.auth/linkedin-session.meta.json` |
| CI secrets (план) | `LINKEDIN_AUTH_STATE_B64`, `LINKEDIN_AUTH_META_B64` |
| Главный cookie | `li_at` |
| Id в БД | `provider=linkedin` + `external_id` |
| Официальный Jobs API | нет (партнёрка) |

Пока `requireActiveJobBoard("linkedin")` падает. Не копируйте `src/playwright/apply.ts` «как есть» — у LinkedIn другая поверхность (Easy Apply vs внешняя заявка).

## Что должно быть общим, а что нет

| Слой | Общий? | Где |
| ---- | ------ | --- |
| Контракт борда | да | `src/providers/types.ts` |
| Схема URL / auth / лимиты | по файлу на сервис | `src/providers/hh.ts`, `linkedin.ts` |
| Playwright login / search / apply | нет, адаптер | `src/playwright/*` сегодня = HH |
| Upsert + rank + retention | да, после нормализации | `src/services/*` |
| Профиль и письма | да | `content/` |

## Перед включением LinkedIn

1. Адаптеры `src/playwright/linkedin/` (auth, search, apply Easy Apply).
2. Slim-export cookies `linkedin.com`, отдельный secret.
3. Задержки выше HH (`scrapeDelayMs` 2500, `applyDelayMs` 8000 в схеме).
4. Сначала только локально: IP GitHub Actions для LinkedIn почти наверняка checkpoint.

Схема БД уже готова: `provider` + `external_id`. Осталось писать строки с `provider = linkedin`.

## Два пути сбора на HH — не путать

| | Playwright (`hh:scrape`) | API (`hh:sync`) |
| --- | ------------------------ | --------------- |
| Зачем | Основной цикл + отклики | Запасной сбор списка |
| Auth | cookies соискателя | токен приложения |
| Отклик | да | нет |
| Документация | [SCRAPING.md](./SCRAPING.md), [AUTH.md](./AUTH.md) | [ENV.md](./ENV.md) |
