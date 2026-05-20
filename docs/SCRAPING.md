# HH.ru scraping (Playwright)

Соискательский API закрыт → вакансии собираем через браузерную сессию.

## Поток

1. `src/playwright/auth.setup.ts` — логин на **hh.ru** по `HH_EMAIL` / `HH_PASSWORD`
2. Cookies → `.auth/hh-user.json`, метаданные → `.auth/hh-session.meta.json` (`provider: "hh.ru"`)
3. Поиск: `{baseUrl}/search/vacancy?text=...`
4. Список: `div[id]` с числовым id и/или ссылки `/vacancy/{id}`
5. Карточка: `{baseUrl}/vacancy/{id}` → парсинг title, company, salary, description
6. `upsert` в таблицу `vacancies` по `hh_id`

## Команды

```bash
# один раз после смены пароля / истечения сессии
npm run playwright:auth

# сбор вакансий в БД
npm run hh:scrape
```

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
