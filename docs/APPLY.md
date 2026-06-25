# Автоотклик (Playwright)

Без Telegram. По умолчанию шаг `apply` использует `content/cover-letter.md` как fallback и пытается сгенерировать короткое письмо под вакансию через DeepSeek.

## Два способа запуска отклика

| Способ | Где в IDE | БД `applications` |
| ------ | --------- | ----------------- |
| **`npm run hh:apply`** | Скрипт `scripts/hh-apply-once.ts` | ✅ пишет |
| **`npm run playwright:apply`** | Тест `src/playwright/apply.scrape.ts` | ❌ только UI |

В Test Explorer видны только файлы `*.scrape.ts` и `auth.setup.ts`. Логика отклика общая: `src/playwright/apply.ts`.

## Цепочка (продакшен)

```bash
npm run hh:scrape    # вакансии в БД
npm run ai:rank      # analyses.score
npm run hh:apply     # отклик на hh.ru → applications
```

## Тест одной вакансии (Playwright UI)

```bash
# в .env: HH_VACANCY_ID=132469416
npm run playwright:apply
```

По умолчанию `APPLY_DRY_RUN=true` — форма заполняется, «Отправить» не нажимается.

Полный прогон (с логином):

```bash
npm run playwright:auth
npm run hh:scrape && npm run ai:rank && npm run hh:apply
```

## Env

```env
APPLY_MIN_SCORE=75
APPLY_MAX_PER_RUN=30
APPLY_MAX_VACANCIES=30
APPLY_DELAY_MS=3000
APPLY_DRY_RUN=true   # false — реальная отправка отклика
```

`APPLY_MAX_VACANCIES` — понятный alias для тестов; если задан, имеет приоритет над `APPLY_MAX_PER_RUN`.

## Кого откликаем

- Есть `analysis` с `score >= APPLY_MIN_SCORE`
- Нет записи с блокирующим статусом: `applied`, `already_applied`, `skipped_foreign_country`
- Повтор возможен после `dry_run`, `failed`, `no_response_button` (например `APPLY_DRY_RUN=false`)
- Сортировка: сначала выше score

## Сопроводительное

Редактируйте **`content/cover-letter.md`** — это fallback-стиль и запасной текст, если генерация через DeepSeek недоступна или упала.

Генерация письма:
- на вход идут профиль кандидата, базовое письмо, title/company/description вакансии
- DeepSeek пишет короткое и простое письмо под конкретную вакансию
- если генерация не удалась, используется fallback из `content/cover-letter.md`

## Статусы `applications.status`

| status | Значение |
| ------ | -------- |
| `applied` | Отклик отправлен |
| `dry_run` | Форма заполнена, submit не нажат (`APPLY_DRY_RUN=true`) |
| `already_applied` | Уже откликались на hh.ru |
| `no_response_button` | Нет кнопки отклика |
| `skipped_foreign_country` | Popup «вакансия в другой стране» — пропуск |
| `failed` | Ошибка UI / скрипта |

Фильтр по тестовым заданиям **не реализован** — добавим при необходимости.

## Риски

Капча, лимиты hh.ru — держите `APPLY_MAX_VACANCIES` / `APPLY_MAX_PER_RUN` низким и `APPLY_DELAY_MS` ≥ 3000.
