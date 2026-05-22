# HH.ru scraping (Playwright)

Соискательский API закрыт → вакансии собираем через браузерную сессию.

## Поток

1. `src/playwright/auth.setup.ts` — логин на **hh.ru** по `HH_EMAIL` / `HH_PASSWORD`
2. Cookies → `.auth/hh-user.json`, метаданные → `.auth/hh-session.meta.json` (`provider: "hh.ru"`)
3. Поиск по прямому URL (без инпута): `{baseUrl}/search/vacancy?text=...&search_field=name`  
   Фраза: секция **«Поиск на hh.ru»** в `content/candidate-profile.md` (или `HH_SEARCH_KEYWORD` в `.env`).  
   Кодирование: `URLSearchParams` (пробелы → `+`, кириллица → `%D0%...`).
4. На каждой странице — id в массив; далее клик `a[data-qa="pager-next"]`, пока ссылка есть (лимит `HH_SCRAPE_MAX_PAGES`)
5. Список: `div[id]` с числовым id и/или ссылки `/vacancy/{id}`
6. Карточка: `{baseUrl}/vacancy/{id}` → парсинг title, company, salary, description
7. `upsert` в таблицу `vacancies` по `hh_id`

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
| `db ok hh_id=… title="…"` | Запись в Supabase успешна |
| `db fail hh_id=… error=…` | Ошибка Prisma / БД |
| `scrape fail hh_id=…` | Не открылась или не распарсилась карточка |
| `search page N: +M ids` | Собрано id с страницы выдачи |
| `finished upserted=… failed=…` | Итог прогона |

## TODO

- **Неполный сбор id** со всех страниц выдачи: доработать пагинацию `pager-next` (ожидание, дедуп, лимиты). См. комментарий в `collectVacancyIdsFromSearch`.

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
