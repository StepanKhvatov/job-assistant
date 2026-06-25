# HH.ru scraping (Playwright)

Соискательский API закрыт → вакансии собираем через браузерную сессию.

## Поток

1. `src/playwright/auth.setup.ts` — логин на **hh.ru** по `HH_EMAIL` / `HH_PASSWORD`
2. Cookies → `.auth/hh-user.json`, метаданные → `.auth/hh-session.meta.json` (`provider: "hh.ru"`)
3. Поиск по прямому URL (без инпута): `{baseUrl}/search/vacancy?text=...&search_field=name&items_on_page=50`  
   Фраза: секция **«Поиск на hh.ru»** в `content/candidate-profile.md` (или `HH_SEARCH_KEYWORD` в `.env`).  
   Кодирование: `URLSearchParams` (пробелы → `+`, кириллица → `%D0%...`).
4. Из `[data-qa="title"]` читается строка вида **«Найдено N вакансий»** → число страниц = `ceil(N / 50)`.
5. На каждой странице — id карточек `[data-qa="vacancy-serp__vacancy"]`; переход делается прямым `goto` на тот же search URL с `page=0..N-1`.
6. Дедуп id в памяти; в БД — `hh_id` unique + upsert; уже сохранённые id **не парсятся повторно** (skip).
7. Карточка: `{baseUrl}/vacancy/{id}` → парсинг title, company, salary, description
8. `upsert` в таблицу `vacancies` по `hh_id`

## Команды

```bash
# Полный цикл: логин → поиск → карточки → Supabase
npm run hh:run

# Если сессия в .auth/ ещё живая — без повторного логина:
npm run hh:scrape
```

### Параметры URL выдачи

| Параметр | Нужен | Описание |
| -------- | ----- | -------- |
| `text` | да | Одна фраза (`HH_SCRAPE_KEYWORD`), UTF-8 |
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
| Капча / 2FA                  | `HH_SCRAPE_HEADLESS=false`, ручной проход, реже запускать   |
| Смена вёрстки hh.ru          | селекторы `data-qa` + fallback                              |
| Блокировка за частые запросы | `HH_SCRAPE_DETAIL_DELAY_MS`, лимиты страниц/вакансий        |
| ToS hh.ru                    | личное использование, низкая частота, без массовых откликов |

## Отличие от API-пути

|              | API (`hh:sync`)  | Scrape (`hh:scrape`)    |
| ------------ | ---------------- | ----------------------- |
| Авторизация  | Токен приложения | Логин соискателя        |
| Стабильность | Выше             | Зависит от UI           |
| Отклики      | Нет (API закрыт) | Тот же Playwright позже |
