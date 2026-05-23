# Мастер-резюме

Источник правды для hh, LinkedIn и сопроводительных писем. Без телефона, email и ФИО.  
Структура для машин: [experience.yaml](./experience.yaml). Рекомендации по применению: [RECOMMENDATIONS.md](./RECOMMENDATIONS.md).

---

## Заголовок

**Middle Frontend Developer** · React, TypeScript, Next.js (App Router) · fintech / крипта, SEO-сайты, продуктовые приложения

**Статус:** открыт к предложениям. Новосибирск или удалёнка по России. Английский — A2.

---

## О себе

Middle frontend, коммерческий опыт с конца 2020 года.

В **SquareFi** делал кошелёк виртуальных карт на Next.js 15 (App Router, Server Components, Server Actions): реализовал серверную JWT-авторизацию в httpOnly cookies с refresh-token rotation и дедупликацией refresh-запросов.

В **Immigrant Invest** развивал 3 продукта в monorepo (Nx, Next.js) с фокусом на SEO и Core Web Vitals: тысячи мультиязычных страниц, Storyblok + Strapi (включая ручки и миграцию на Strapi 4), next-intl, Vercel.

В **DexPilot** вырос от Junior до Middle на криптоплатформе и платёжной системе 0xProcessing (Redux Toolkit, WebSocket); в 2025 — приложение-терминал для торговли на Solana.

Ищу продуктовую команду на React/Next.js, где смогу развивать архитектуру monorepo, performance и серверную часть Next.js.

---

## Навыки

**Core:** TypeScript, JavaScript, React, Next.js (App Router, RSC, Server Actions), Node.js (BFF)  
**State:** Redux Toolkit, Zustand  
**UI:** Tailwind CSS, Storybook, HTML/CSS  
**i18n:** next-intl, мультиязычные URL-структуры  
**Quality:** Vitest, Jest, Playwright (E2E)  
**Architecture & tooling:** Nx (monorepo), GitLab CI (настройка pipeline), Git  
**Backend-for-frontend / CMS:** Strapi (контроллеры, ручки, миграция на Strapi 4, Strapi Cloud), Storyblok, OpenAPI-клиент  
**Auth & infra:** server-side authentication (JWT, httpOnly cookies, refresh-token rotation), Vercel, Telegram Mini Apps  
**Домен:** WebSocket, крипто-платежи, Solana (terminal app), HTML-email (JSX → письма), SEO / Core Web Vitals

---

## Опыт работы

### SquareFi — Middle Frontend Developer

*Ноябрь 2025 — Февраль 2026 · полная занятость*  
[squarefi.co](https://squarefi.co/)

- Фронтенд кошелька виртуальных карт (крипто-продукт) на Next.js 15: App Router, Server Components, Server Actions; TypeScript.
- Реализовал **серверную JWT-авторизацию**: access/refresh-токены в httpOnly cookies, refresh-token rotation, отдельные flow для Web и Telegram Mini App.
- Спроектировал auth-middleware вокруг OpenAPI-клиента: дедупликация refresh при параллельных 401-запросах (Mutex + AsyncLocalStorage + React `cache()`), синхронизация куков из Server Components на клиент через клиентский sync-компонент.
- State через **Zustand**; E2E-тесты на Playwright, unit — Vitest.

### DexPilot — Frontend Developer (Junior → Middle)

*Июнь 2025 — Сентябрь 2025 · частичная занятость (возвращение)*  
*Март 2021 — Апрель 2023 · полная занятость (рост от Junior до Middle)*

- **2025 (part-time):** приложение-терминал для торговли на **Solana** — фронтенд под Web3-сценарии.
- **2021–2023:** криптоплатформа Zenfuse → DexPilot — терминал ордеров на **Redux Toolkit**, мониторинг бирж, WebSocket-коннекторы к биржам.
- Фронтенд [0xprocessing.com](https://0xprocessing.com/) — формы крипто-платежей (Redux Toolkit), JSX → валидные HTML-письма для рассылок.
- **Strapi** — хранение пользователей, ручки и контроллеры.
- Оптимизация 10+ страниц под производительность и масштабируемость; код-ревью.

### Immigrant Invest — Middle Frontend Developer

*Апрель 2023 — Июнь 2025 · полная занятость*

- Развитие 3 продуктов в monorepo (Nx, Next.js): [immigrantinvest.com](https://immigrantinvest.com/ru/), [mygoldenvisa.io](https://mygoldenvisa.io/), каталог недвижимости [property.passportivity.com](https://property.passportivity.com/ru/); запустили дочерний мультитенант [imin-cyprus.com](https://imin-cyprus.com/ru/) для усиления SEO.
- **Масштаб:** 3000+ страниц блога, 1500+ страниц недвижимости, мультиязычность через next-intl; команда 3 фронта, 2–3 релиза в неделю.
- **SEO и Core Web Vitals:** работа над LCP/CLS, серверный рендеринг, оптимизация изображений и шрифтов, структура мультиязычных URL.
- **CMS:** Storyblok — 30+ переиспользуемых компонентов-блоков для страниц; **Strapi** — каталог объектов недвижимости (1500+), писал контроллеры/ручки; провёл миграцию данных на Strapi 4; немного работал со Strapi Cloud.
- Тесты: **Vitest**, Jest, Playwright. Деплой на **Vercel**, сборка проекта 1–3 минуты.
- **GitLab CI** — настройка и сопровождение pipeline. **Storybook** для UI. **Telegram Mini Apps.**

### Flake Design — Frontend-разработчик

*Декабрь 2020 — Март 2021 · полная занятость*

- [didigallery.com](https://didigallery.com/ru) — веб-приложение/галерея; интеграция API платёжных систем; **Strapi** для контента.

---

## Образование

- **2022** — Яндекс Практикум, React-разработчик
- **2020** — Яндекс Практикум, Веб-разработчик

Высшего образования нет.

---

## Ссылки

- Портфолио: [https://www.khvatov.ru](https://www.khvatov.ru)
- GitHub: [https://github.com/StepanKhvatov](https://github.com/StepanKhvatov)

