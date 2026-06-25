# HH.ru scraping (Playwright)

Соискательский API закрыт → вакансии собираем через браузерную сессию.

## Поток

1. **Один раз локально:** `npm run playwright:auth` — логин на **hh.ru** (`HH_EMAIL` / `HH_PASSWORD`), при капче — `HH_SCRAPE_HEADLESS=false`
2. Cookies → `.auth/hh-user.json`, метаданные → `.auth/hh-session.meta.json`
3. **Каждый запуск:** `hh:scrape` / `hh:apply` / `hh:pipeline` используют сохранённую сессию (без логина)
4. Перед scrape/apply — проверка: открывается `/applicant/vacancies` без редиректа на login/captcha
5. **CI:** `npm run hh:auth:restore` восстанавливает `.auth/` из `HH_AUTH_STATE_B64`
6. Поиск по прямому URL (без инпута): `{baseUrl}/search/vacancy?text=...&search_field=name&items_on_page=50&area=113`  
   `area=113` — **Россия** (вакансии в РФ, без зарубежных).  
   Фраза: секция **«Поиск на hh.ru»** в `content/candidate-profile.md` (или `HH_SEARCH_KEYWORD` в `.env`).
7. Из `[data-qa="title"]` читается строка вида **«Найдено N вакансий»** → число страниц = `ceil(N / 50)`.
8. На каждой странице — id карточек `[data-qa="vacancy-serp__vacancy"]`; переход делается прямым `goto` на тот же search URL с `page=0..N-1`.
9. Дедуп id в памяти; в БД — `hh_id` unique + upsert; уже сохранённые id **не парсятся повторно** (skip).
10. Карточка: `{baseUrl}/vacancy/{id}` → парсинг title, company, salary, description
11. `upsert` в таблицу `vacancies` по `hh_id`

## Команды

```bash
# Полный цикл без логина (нужна живая сессия в .auth/)
npm run hh:run

# Только scrape
npm run hh:scrape

# Первый логин или обновление сессии после капчи/истечения
HH_SCRAPE_HEADLESS=false npm run playwright:auth

# Экспорт сессии в GitHub Secrets
npm run hh:auth:export
```

### Параметры URL выдачи

| Параметр | Нужен | Описание |
| -------- | ----- | -------- |
| `text` | да | Одна фраза (`HH_SCRAPE_KEYWORD`), UTF-8 |
| `area` | да | `113` — Россия |
| `search_field=name` | опционально | Только в названии вакансии |
| `page` | нет | Пагинация через клик `pager-next` в браузере |
| `from`, `suggestId`, `hhtmFrom`, `hhtmFromLabel`, `ored_clusters` | нет | Трекинг / подсказка из UI |

## Логи

Префикс `[job-assistant]`:

| Сообщение | Значение |
| --------- | -------- |
| `search title="Найдено N вакансий"` | Содержимое заголовка поиска из `[data-qa="title"]` |
| `search total reported=N total_pages=M` | Всего вакансий по выдаче и сколько страниц нужно обойти |
| `search page N/M: +K ids` | Собрано новых id с страницы (без дублей) |
| `db ok hh_id=… title="…"` | Запись в Supabase успешна |
| `db fail hh_id=… error=…` | Ошибка Prisma / БД |
| `scrape fail hh_id=…` | Не открылась или не распарсилась карточка |
| `skip (already in db)` | Вакансия уже есть в `vacancies` — карточку не открываем |
| `finished upserted=… skipped_existing=…` | Итог прогона |

## Карточка вакансии

- URL: `{baseUrl}/vacancy/{hhId}`
- Селекторы: [VACANCY_PAGE_SELECTORS.md](./VACANCY_PAGE_SELECTORS.md)
## Риски

| Риск                         | Митигация                                                   |
| ---------------------------- | ----------------------------------------------------------- |
| Капча / 2FA                  | Логин только локально (`playwright:auth`), сессия в secret  |
| Истекшая сессия в CI         | `hh:auth:export` → обновить `HH_AUTH_STATE_B64`             |
| Смена вёрстки hh.ru          | селекторы `data-qa` + fallback                              |
| Блокировка за частые запросы | `HH_SCRAPE_DETAIL_DELAY_MS`, лимиты страниц/вакансий        |
| ToS hh.ru                    | личное использование, низкая частота, без массовых откликов |

## Отличие от API-пути

|              | API (`hh:sync`)  | Scrape (`hh:scrape`)    |
| ------------ | ---------------- | ----------------------- |
| Авторизация  | Токен приложения | Логин соискателя        |
| Стабильность | Выше             | Зависит от UI           |
| Отклики      | Нет (API закрыт) | Тот же Playwright позже |
