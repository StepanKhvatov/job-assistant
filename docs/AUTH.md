# Сессии и токены

На hh.ru у этого проекта **нет OAuth refresh token**. Рабочий путь — cookies Playwright. API-токен приложения (`HH_ACCESS_TOKEN`) — отдельная история и для откликов не подходит.

LinkedIn в рантайме ещё нет; когда появится, схема та же: cookies, не OAuth. См. [PROVIDERS.md](./PROVIDERS.md).

## Что считается «токеном»

| Что | Где живёт | Как обновлять | Срок |
| --- | --------- | ------------- | ---- |
| Cookies hh.ru (основной путь) | `.auth/hh-user.json` + `.auth/hh-session.meta.json` | `HEADLESS=false npm run playwright:auth`, затем при необходимости `npm run hh:auth:export` | Дни–недели; CI сам не обновляет |
| `HH_AUTH_STATE_B64` | GitHub Secret | После локального логина: `npm run hh:auth:export` | Копия тех же cookies |
| `HH_ACCESS_TOKEN` | `.env` / secret | Вручную на [dev.hh.ru/admin](https://dev.hh.ru/admin) | Токен приложения, refresh нет |
| `DEEPSEEK_API_KEY` | `.env` / secret | Новый ключ на platform.deepseek.com | Пока не отозван |
| LinkedIn `li_at` (план) | `.auth/linkedin-user.json` | Тот же headed-логин | Короткий; checkpoint часто |

Логин в CI **не выполняется**. Чтобы сохранить сессию на своей машине, нужны `HH_EMAIL` / `HH_PASSWORD` в `.env` и команда:

```bash
HEADLESS=false npm run playwright:auth
```

Без `HEADLESS=false` браузер headless: капча не решается, cookies не запишутся.

## Когда обновлять сессию hh.ru

Обновляйте, если любое из этого верно:

1. `npm run hh:auth:check` пишет `session not alive` (на главной есть `<a role="button" data-qa="login">`, редирект на `/account/login`, капча или форма логина).
2. Прогон `hh:scrape` / `hh:apply` падает с той же ошибкой.
3. В логе apply: `session=guest` / `login_required` — cookies открывают вакансию, но отклик требует полноценного логина. Кнопка «Откликнуться» на карточке **не** значит, что вход выполнен: она есть и у гостя.
4. Проверка предупреждает, что cookies истекают в ближайшие дни.
5. Меняли `HH_BASE_URL` (сессия с `novosibirsk.hh.ru` не подходит для `hh.ru`).
6. На сайте hh.ru разлогинились во всех браузерах.

Не ждите «месяц». Если pipeline снова включите в GitHub Actions — закладывайте обновление secret раз в 1–2 недели.

## Локально: проверить

```bash
npm run hh:auth:check
```

Скрипт:

1. Если задан `HH_AUTH_STATE_B64` — восстановит `.auth/` из него.
2. Иначе возьмёт уже лежащий `.auth/hh-user.json`.
3. Откроет Chromium с этими cookies, зайдёт на главную `{HH_BASE_URL}/` и ищет `<a role="button" data-qa="login">`. Если тег есть — вход не выполнен.
4. Затем сходит на `/applicant/vacancies` (не login, не captcha).
5. Покажет срок жизни cookies (поле `expires` в storageState).

Ок: в логе `operation=hh:auth:check done`, `alive=yes` и `login_link=no`.  
Плохо: `login_link` / `redirected to login` / `header still shows Войти` / `captcha required` — сохраните сессию заново:

```bash
HEADLESS=false npm run playwright:auth
```

## Локально: сохранить сессию

Нужны `HH_EMAIL` и `HH_PASSWORD` в `.env`. Капча почти всегда — браузер должен быть видимым. Команда, которая логинится и **записывает** cookies:

```bash
HEADLESS=false npm run playwright:auth
```

После успеха появятся (или перезапишутся):

- `.auth/hh-user.json` — Playwright `storageState`
- `.auth/hh-session.meta.json` — `provider`, `baseUrl`, `authenticatedAt`

Проверьте сразу:

```bash
npm run hh:auth:check
```

`.auth/` в git не коммитится.

## GitHub Actions: обновить secret

Сначала сохраните сессию локально (`HEADLESS=false npm run playwright:auth`). Экспорт **slim**: только cookies `*.hh.ru`, без localStorage. Полный `hh-user.json` (~650 KB) в secret GitHub (64 KB) не влезет.

```bash
npm run hh:auth:export
```

Вывод — две строки. В репозитории: **Settings → Secrets and variables → Actions**:

| Secret | Откуда |
| ------ | ------ |
| `HH_AUTH_STATE_B64` | вывод export (обязателен) |
| `HH_AUTH_META_B64` | вывод export (желателен) |

Старые значения замените целиком. `HH_EMAIL` / `HH_PASSWORD` в Actions не кладите.

Проверка: **Actions → HH Pipeline → Run workflow**. Нужны secrets `HH_AUTH_STATE_B64` (и желательно `HH_AUTH_META_B64`).

## Если капча или 2FA

1. Только headed: `HEADLESS=false npm run playwright:auth`.
2. Пройдите капчу / код вручную, пока Playwright ждёт ухода с `/account/login` (таймаут 60 с). Если не успели — ту же команду ещё раз.
3. Не логиньтесь из CI. IP GitHub для hh.ru — плохой сигнал.

## API-токен приложения (`hh:sync`)

Это **не** сессия соискателя. Токен с [dev.hh.ru](https://dev.hh.ru/admin) умеет искать вакансии и не умеет откликаться.

- Протух / 401 / 403 — зайдите в кабинет приложения и скопируйте новый access token в `HH_ACCESS_TOKEN`.
- Refresh-endpoint у этого токена нет.
- Для повседневного цикла (`hh:pipeline`) этот путь не нужен.

## LinkedIn (когда будете включать)

Тот же ритуал, другие файлы и secret (см. схему в `src/providers/linkedin.ts`):

1. Headed-логин → `.auth/linkedin-user.json`.
2. Проба: `/feed/` без `/login`, `/checkpoint/`, `/challenge/`.
3. Slim-export только cookies `linkedin.com` (`li_at` — главный).
4. CI с IP GitHub, скорее всего, поймает checkpoint — сначала гоняйте локально.

Пока `status: "planned"`: команды `linkedin:*` не существуют, `requireActiveJobBoard("linkedin")` бросит ошибку.

## Частые ошибки

| Симптом | Что сделать |
| ------- | ----------- |
| `HH auth state missing` | `HEADLESS=false npm run playwright:auth` |
| `session was created for X, but scrape uses Y` | Выровнять `HH_BASE_URL` и снова `HEADLESS=false npm run playwright:auth` |
| `HH_AUTH_STATE_B64 is invalid` | Заново `hh:auth:export`, в secret без переносов и кавычек |
| Secret > 65536 chars | Убедиться, что export slim, не сырой `hh-user.json` |
| Капча на каждом логине | Пауза, другой IP, не крутить headless-логин |
