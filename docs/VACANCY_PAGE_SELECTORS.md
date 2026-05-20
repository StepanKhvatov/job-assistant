# Селекторы страницы вакансии hh.ru

Анализ: `view-source` для [vacancy/132469416](https://novosibirsk.hh.ru/vacancy/132469416) (НПФ Гранч, Middle Frontend developer).

## Поля → селекторы (приоритет)

| Поле БД | Основной селектор | Fallback |
| -------- | ----------------- | -------- |
| `title` | `[data-qa="vacancy-title"]` | `h1` |
| `company` | `[data-qa="vacancy-company-name"]` | `[data-qa="vacancy-company"] a` |
| `salary` | `[data-qa="vacancy-salary"]` | текст рядом с заголовком («Уровень дохода…», `₽`); `meta[name=description]` → `Зарплата: …` |
| `description` | `[data-qa="vacancy-description"]` | `[data-qa="vacancy-branded-description-content"]` |
| `publishedAt` | `[data-qa="vacancy-creation-time"]` | `meta description` → `Дата публикации: DD.MM.YYYY`; JSON в HTML → `"publicationTime":{"$":"ISO…"}` |

## Стабильные `data-qa` на карточке (2026)

- `vacancy-title` — заголовок (h1)
- `vacancy-company-name` — ссылка на работодателя
- `vacancy-company` — блок компании
- `vacancy-description` — текст вакансии
- `vacancy-experience` — опыт («1–3 года»), в БД пока не пишем
- `vacancy-view-raw-address` — адрес

На этой вакансии **нет** `vacancy-salary` и **нет** `vacancy-creation-time` в DOM — зарплата в соседнем `span`, дата в meta/JSON.

## URL

```
{HH_SCRAPE_BASE_URL}/vacancy/{hhId}
```

Без utm-параметров (короче и стабильнее).

## Реализация

Парсинг — `src/playwright/vacancy-page.ts`, запись — `src/services/upsert-vacancy.ts`, логи — `src/utils/log.ts`, запуск — `npm run hh:run` или `npm run hh:scrape`.
