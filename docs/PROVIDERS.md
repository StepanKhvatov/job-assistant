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
hh:auth:check    →  главная `{base}/` без `<a role="button" data-qa="login">`, затем GET /applicant/vacancies
       ↓
hh:scrape        →  /search/vacancy?text=… (по каждой фразе) → union id → /vacancy/{id}  →  vacancies
       ↓
ai:rank          →  analyses.score
       ↓
hh:apply         →  кнопка «Откликнуться»  →  applications.status
```

| | |
| --- | --- |
| Сайт | `HH_BASE_URL`, дефолт `https://novosibirsk.hh.ru` |
| Логин | `{base}/account/login` |
| Проба сессии | главная `{base}/` без `a[role=button][data-qa=login]`, затем `{base}/applicant/vacancies` |
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

## OOP и Playwright — что используем

Классическое наследование (`abstract class LinkedIn extends JobBoard`) здесь не подходит:

- Playwright `Page` / `Locator` уже объекты; обёртка-иерархия не даёт общих селекторов.
- HH и LinkedIn не разделяют шаги apply (модалка data-qa vs Easy Apply vs внешний ATS). Template Method превратится в пустые хуки.
- Логин — headed Playwright Test с капчей, не метод базового класса.

Что используем вместо классов:

| Приём | Зачем | Где |
| ----- | ----- | --- |
| Schema-объект | URL, cookies, лимиты, locale | `src/providers/hh.ts`, `linkedin.ts` |
| Strategy / Adapter (plain object) | scrape / session / apply борда | `JobBoardPlaywrightAdapter` |
| Фабрика | выбрать адаптер по `JobBoardId` | `getPlaywrightAdapter()` |
| Оркестрация без наследования | общий цикл браузер → БД | `src/services/vacancy-*-sync.ts` |

HH уже зарегистрирован: `src/playwright/hh-adapter.ts`. LinkedIn появится как **второй объект того же типа**, не subclass.

## Что должно быть общим, а что нет

| Слой | Общий? | Где |
| ---- | ------ | --- |
| Контракт борда | да | `src/providers/types.ts` |
| Схема URL / auth / лимиты / browser | по файлу на сервис | `src/providers/hh.ts`, `linkedin.ts` |
| Playwright login / search / apply | нет, адаптер | `src/playwright/hh-adapter.ts`; LinkedIn — TODO |
| Оркестрация scrape / apply | да | `src/services/vacancy-scrape-sync.ts`, `vacancy-apply-sync.ts` |
| Slim cookies / encode secret | да | `src/playwright/auth-state.ts` |
| Upsert + rank + retention | да, после нормализации | `src/services/*` |
| Профиль и письма | да | `content/` |

## TODO: LinkedIn runtime

Схема БД и реестр борда уже есть. Не писать LinkedIn-методы поверх HH-файлов.

1. **Auth (headed)** — `auth.setup` / `npm run playwright:auth:linkedin` → `.auth/linkedin-user.json` + meta. Капча / checkpoint / 2FA только локально.
2. **Проба сессии** — `/feed/` без `/login`, `/checkpoint/`, `/challenge/`. Не считать кнопку Apply доказательством входа.
3. **`linkedinPlaywrightAdapter`** — реализовать `JobBoardPlaywrightAdapter`, положить в `src/playwright/linkedin/` (auth, search, detail, apply). Зарегистрировать в `PLAYWRIGHT_ADAPTERS`.
4. **Search** — `/jobs/search/?keywords=…` → id; задержка `scrapeDelayMs` 2500 из схемы.
5. **Карточка** — `/jobs/view/{id}` → `ScrapedVacancyDetail` с `provider: "linkedin"`.
6. **Apply** — только Easy Apply; «Apply on company site» / внешний ATS → новый skip-статус (не копировать HH-модалку). Задержка `applyDelayMs` 8000.
7. **Env** — когда появится рантайм: `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD` (только локальный логин). Не класть в CI. Поисковая фраза — отдельная секция в `content/candidate-profile.md` или `LINKEDIN_SEARCH_KEYWORD`.
8. **Slim-export** — cookies `linkedin.com` (`li_at`), secrets `LINKEDIN_AUTH_STATE_B64` / `LINKEDIN_AUTH_META_B64`. Переиспользовать `encodeAuthStateForSecret`.
9. **Скрипты** — `linkedin:auth:check`, `linkedin:scrape`, `linkedin:apply`. `ai:rank` общий, без изменений.
10. **CI** — не включать LinkedIn в GitHub Actions, пока сессия не стабильна локально (датацентр GitHub → checkpoint).
11. **Опционально** — перенести HH Playwright-файлы в `src/playwright/hh/`, когда появится папка `linkedin/`.

Схема БД уже готова: `provider` + `external_id`. Осталось писать строки с `provider = linkedin`.

## Два пути сбора на HH — не путать

| | Playwright (`hh:scrape`) | API (`hh:sync`) |
| --- | ------------------------ | --------------- |
| Зачем | Основной цикл + отклики | Запасной сбор списка |
| Auth | cookies соискателя | токен приложения |
| Отклик | да | нет |
| Документация | [SCRAPING.md](./SCRAPING.md), [AUTH.md](./AUTH.md) | [ENV.md](./ENV.md) |
