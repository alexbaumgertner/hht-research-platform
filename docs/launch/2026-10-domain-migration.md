# Переезд на hht.rarediseasedigest.org (2026-10)

Канонический адрес: `https://hht.rarediseasedigest.org`. Ветка: `chore/domain-migration`.
Проверено 2026-10-01 (код, тесты, read-only запросы к проду, DNS, Vercel env, Cloud Run).

## 0. Блокеры запуска подписки для людей

| #   | Блокер                                                                                                                                                                                                                                                                                                                                                                              | Где чинить                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| B1  | **У воркера нет почтового окружения.** На Cloud Run Job только `PUBLIC_SITE_URL` (старый хост), `PAYLOAD_API_KEY`, `AI_GATEWAY_API_KEY`. Нет `PAYLOAD_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — sweep подписок каждый час пропускается с ERROR `subscription sweep skipped: PAYLOAD_SECRET is not set`, выпуски подписчикам не уходят вообще.                                | GCP, §5 шаг 5             |
| B2  | **Первый же sweep с почтой разошлёт архив.** `listSubscriptionDigests` берёт 30 последних выпусков без ограничения по возрасту; у всех текущих выпусков (id 6, 7, 8, 11, 13, 14, 15) `subscriberFanoutAt` пуст, потому что sweep ни разу не прошёл. Каждый подтверждённый подписчик получит до 7 писем сразу (и VK — до 7 постов, если задан токен). Нужно твоё решение, см. §7 Q1. | решение + данные или код  |
| B3  | **DMARC не опубликован.** Нет TXT ни на `_dmarc.hht.rarediseasedigest.org`, ни на `_dmarc.rarediseasedigest.org` (DoH Cloudflare, 2026-10-01). Gmail/Yahoo требуют DMARC от массовых отправителей.                                                                                                                                                                                  | Cloudflare DNS, §5 шаг 1  |
| B4  | **Вебхук Resend не работает.** `RESEND_WEBHOOK_SECRET` нет ни в одной среде Vercel → `/api/webhooks/resend` отвечает `400 Not configured`, bounce/complaint не отписывают адрес.                                                                                                                                                                                                    | Resend + Vercel, §5 шаг 2 |
| B5  | **`hhtnews.growtomiddle.dev` не редиректит.** `/en/projects/hht/issues/15` и `/api/health` на старом хосте отвечают `200`, корень — `307` на `/en` того же хоста. Ожидался `308` на новый домен. Корень, `www` и `http://` нового домена редиректят правильно.                                                                                                                      | Vercel Domains, §5 шаг 6  |
| B6  | **Ссылки в VK-постах и в owner kit были относительными** (баг в коде, исправлен в этой ветке, коммит `9adf134`). До мержа VK-посты получили бы `/ru/projects/...` без хоста.                                                                                                                                                                                                        | мерж ветки                |

## 1. Хардкод: что нашёл и что сделал

Команда из задачи (`rg "growtomiddle|hhtnews|vercel\.app|resend\.dev|onboarding@|localhost:3000"`) плюс проверка инфраструктуры.

| Место                                                                                     | Что там                                            | Решение                                                                                                                                |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md:30](../../README.md)                                                           | `Live: hhtnews.growtomiddle.dev`                   | Заменено на новый домен (`0dd9e2e`).                                                                                                   |
| [docs/backups.md:32](../backups.md)                                                       | `curl …growtomiddle.dev/api/cron/backup`           | Заменено.                                                                                                                              |
| [docs/deploy-worker.md](../deploy-worker.md) (таблица env, uptime check)                  | `your-app.vercel.app`, старый хост в uptime        | Заменено; добавлены `PAYLOAD_SECRET`, `RESEND_*`, `VK_COMMUNITY_TOKEN` для воркера; убрано ложное «`PAYLOAD_SECRET` не нужен воркеру». |
| [apps/web/src/lib/siteUrl.ts:12](../../apps/web/src/lib/siteUrl.ts)                       | `localhost:3000`                                   | Оставлено: последний fallback после `PUBLIC_SITE_URL` и `VERCEL_URL`.                                                                  |
| [apps/worker/src/notify/digestEmail.ts:33](../../apps/worker/src/notify/digestEmail.ts)   | `localhost:3000`                                   | Оставлено: недостижимо, воркер не стартует без `PUBLIC_SITE_URL` ([index.ts:31](../../apps/worker/src/index.ts)).                      |
| `email.ts:52,60`, `payload.config.ts:74`, `digestEmail.ts:55`, `subscriptionSweep.ts:162` | fallback `onboarding@resend.dev`                   | Оставлено намеренно: без `RESEND_FROM_EMAIL` уходим в песочницу Resend, а гейт (R12) тогда пишет только владельцу. Безопасный отказ.   |
| `subscriberMail.ts`, `mailGate.ts`, `subscriptionSweep.ts:122` и тесты                    | `@resend.dev`                                      | Оставлено: это и есть sandbox-гейт.                                                                                                    |
| `.env.example:11,19,27,53`                                                                | `localhost:3000`, `onboarding@resend.dev`          | **Не тронуто: файл закрыт для меня настройками доступа.** Значения подходят для локалки; предлагаемые комментарии — §7 Q3.             |
| `apps/web/playwright.config.ts`, `.github/workflows/ci.yml`, `.cursor/install.sh`         | `localhost:3000`, `onboarding@resend.dev`          | Оставлено: локальная среда и CI.                                                                                                       |
| `docs/roadmap-2026-q4.md:27,77,81,93`                                                     | `*.vercel.app`, `resend.dev`                       | Оставлено: исторический аудит, решения в `docs/` зафиксированы.                                                                        |
| `specs/00*/quickstart.md`, `specs/006-*/{plan,research,tasks,contracts}`                  | `localhost:3000`, `resend.dev`                     | Оставлено: инструкции для локалки и описание гейта.                                                                                    |
| **Cloud Run Job `hht-monitor-worker`**                                                    | `PUBLIC_SITE_URL=https://hhtnews.growtomiddle.dev` | Вручную, §5 шаг 5.                                                                                                                     |
| **Cloud Monitoring uptime `hht-health`**                                                  | host `hhtnews.growtomiddle.dev`, только 2xx        | Вручную, §5 шаг 4. Как только старый хост начнёт редиректить, проверка упадёт (3xx не 2xx).                                            |

## 2. Переменные окружения по средам

`✓` — проверено (Vercel API: имена и цели; Cloud Run: `gcloud run jobs describe`), `✗` — нужно действие.

| Переменная              | web Production                                                                                                                       | web Preview                                                                           | web Development                                   | worker (Cloud Run Job)                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `PUBLIC_SITE_URL`       | ✓ `https://hht.rarediseasedigest.org` (canonical на проде это подтверждает)                                                          | ✓ не задана — берётся `VERCEL_URL` превью; так и надо, иначе превью ходит в API прода | не задана; `.env.local` → `http://localhost:3000` | ✗ `https://hhtnews.growtomiddle.dev` → сменить на новый |
| `RESEND_FROM_EMAIL`     | ✓ задана (одна запись на Production+Preview)                                                                                         | = Production; гейт теперь закрыт кодом (`5fc55f0`)                                    | локально `onboarding@resend.dev`                  | ✗ нет → `HHT Digest <news@hht.rarediseasedigest.org>`   |
| `RESEND_API_KEY`        | ✓                                                                                                                                    | ✓ (тот же ключ — см. риск R2)                                                         | опционально                                       | ✗ нет                                                   |
| `PAYLOAD_SECRET`        | ✓                                                                                                                                    | ✓ (своё значение)                                                                     | `.env.local`                                      | ✗ нет → то же значение, что в Production                |
| `PAYLOAD_API_KEY`       | ✓                                                                                                                                    | ✓                                                                                     | `.env.local`                                      | ✓ (Secret Manager)                                      |
| `RESEND_WEBHOOK_SECRET` | ✗ нет                                                                                                                                | не нужна                                                                              | не нужна                                          | не нужна                                                |
| `VK_COMMUNITY_TOKEN`    | ✓ отсутствует (так и должно быть)                                                                                                    | ✓ отсутствует                                                                         | —                                                 | нет; задать, только если у проекта есть `vkCommunityId` |
| `EMAIL_DELIVERY`        | ✓ отсутствует (и игнорируется при `VERCEL_ENV=production`)                                                                           | отсутствует                                                                           | `stub` в e2e                                      | отсутствует                                             |
| `AUTH_EMAIL_FROM`       | не задана → `HHT News <RESEND_FROM_EMAIL>`                                                                                           | —                                                                                     | —                                                 | —                                                       |
| `RESEND_FROM_NAME`      | не задана → Payload-адаптер подпишет `Research Monitoring` (только системные письма Payload, вход идёт по коду через `lib/email.ts`) | —                                                                                     | —                                                 | —                                                       |

Воркер: окружение живёт на самом Cloud Run Job. [`deploy-worker.yml`](../../.github/workflows/deploy-worker.yml) меняет только образ (`gcloud run jobs update --image`), env не трогает — GitHub Secrets менять не нужно.

**Может ли Preview написать реальным подписчикам или в VK?** До этой ветки — частично: превью получает тот же `RESEND_API_KEY` и боевой `RESEND_FROM_EMAIL`, значит гейт был открыт, и любой, кто нашёл URL превью, мог подписаться и получить письмо с боевого домена. Массовой рассылки с превью нет: fan-out и VK делает только воркер, а он работает только против прода; веб шлёт лишь подтверждение тому, кто ввёл адрес, и welcome-выпуск подтвердившему. Защита добавлена: [`mailGate.ts`](../../apps/web/src/lib/mailGate.ts) закрывает гейт при `VERCEL_ENV=preview` — на превью почта уходит только владельцу проекта, как в песочнице (тест [`mailGate.test.ts`](../../apps/web/src/lib/mailGate.test.ts)).

## 3. Чеклист по коду

### Метаданные и SEO

- [x] `metadataBase` из `PUBLIC_SITE_URL` — [metadata.ts `buildRootMetadata`](../../apps/web/src/lib/metadata.ts); на проде все теги на новом хосте (проверено curl как TelegramBot).
- [x] `canonical` на главной, проекте, архиве, выпуске, материале — абсолютный (`buildPageMetadata` + `metadataBase`). e2e `canonical, hreflang and og:image use only PUBLIC_SITE_URL` в [share-metadata.spec.ts](../../apps/web/tests/e2e/share-metadata.spec.ts).
- [x] `hreflang` для всех локалей + **`x-default` (добавлен)** — [seo.ts `localeAlternates`](../../apps/web/src/lib/seo.ts), тесты [seo.test.ts](../../apps/web/src/lib/seo.test.ts) и e2e выше.
- [x] OG/Twitter-картинки абсолютные, генерация работает — e2e `share metadata for chat-app crawlers` (PNG 200, хост = `PUBLIC_SITE_URL`); на проде `og:image` = `https://hht.rarediseasedigest.org/…/opengraph-image`.
- [x] `sitemap.xml` — **не было, добавлен**: [app/sitemap.ts](../../apps/web/src/app/sitemap.ts). Все локали, главная, проекты, архивы, все видимые выпуски и материалы ленты; `alternates` с `x-default`; `lastmod` по дате контента (строку проекта не берём — она меняется каждый прогон). Тест: seo.test.ts + e2e (только один хост).
- [x] `robots.txt` — **не было, добавлен**: [app/robots.ts](../../apps/web/src/app/robots.ts). На проде `Sitemap: https://hht.rarediseasedigest.org/sitemap.xml`, закрыты `/admin`, `/api/`, `/r/`; при любом `VERCEL_ENV` кроме `production` — `Disallow: /`.
- [x] Политика конфиденциальности называет адрес отправителя и домен — новая строка `Privacy.sender` в [privacy/page.tsx](../../apps/web/src/app/[locale]/privacy/page.tsx) (EN/RU; de/tr/uk показывают EN, как и остальной текст). Строка скрыта, пока отправитель `@resend.dev`. e2e проверяет `news@example.com`.

### Письма

- [x] Все ссылки абсолютные из `PUBLIC_SITE_URL`: подтверждение, выпуск, отписка, политика — [subscriberMail.ts](../../apps/web/src/lib/subscriberMail.ts), [subscriptionSweep.ts](../../apps/worker/src/pipeline/subscriptionSweep.ts). Тесты: воркер `links stay on PUBLIC_SITE_URL` (письма, заголовки, VK, owner kit), e2e `mail links stay on PUBLIC_SITE_URL…`. **Исправлено:** VK и owner kit (B6); sweep теперь отказывается работать без `PUBLIC_SITE_URL`.
- [x] `From` из `RESEND_FROM_EMAIL` — `subscriberSender`/`emailSender` в [email.ts](../../apps/web/src/lib/email.ts), `defaultSend` в воркере; e2e проверяет `From` у подтверждения и выпуска. `resend.dev` остался только как fallback-песочница (§1).
- [x] `List-Unsubscribe` во всех рассылочных письмах (выпуск из воркера и welcome-выпуск из веба). В подтверждении его нет осознанно (T028, contract public-subscriptions §2); в owner kit нет осознанно (T050). e2e проверяет отсутствие в подтверждении.
- [x] `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; [`POST /api/unsubscribe/{token}`](../../apps/web/src/app/api/unsubscribe/[token]/route.ts) без авторизации и без страницы, `200`. e2e шлёт `List-Unsubscribe=One-Click` формой и видит `unsubscribed`.
- [x] Видимая ссылка отписки в теле (text и HTML) — [issueEmailBody.ts](../../packages/shared/src/issueEmailBody.ts); e2e и тест воркера.
- [x] `Reply-To` осознанно = email владельца проекта (подтверждение и выпуск): по политике отписаться можно ответом на письмо.
- [x] Токены не привязаны к хосту: `sha256(PAYLOAD_SECRET \0 purpose)` — [mailTokens.ts](../../packages/shared/src/mailTokens.ts). Важно лишь, чтобы `PAYLOAD_SECRET` воркера совпадал с вебом.
- [x] RU и EN, язык из подписки — `CONFIRM_COPY[language]`, `decideLanguageSend` по `delivery.language`; существующие тесты sweep (EN без ожидания, RU через 6 часов с пометкой).
- [x] Атрибуция `src` по спеке 006: ссылки в письмах идут через `/r/{token}/{target}` (флаг клика, без `src`); посты в чаты несут `?src=vk|tg|wa|fb`. UTM в спеке нет. Тесты: `clickRedirect.test.ts`, тест воркера проверяет `?src=vk` и `?src=tg`.

### Вебхуки и интеграции

- [x] Вебхук Resend: `POST /api/webhooks/resend`, подпись Svix проверяется ([route.ts](../../apps/web/src/app/api/webhooks/resend/route.ts), [svixVerify.test.ts](../../apps/web/src/lib/svixVerify.test.ts)). **Но секрет не задан (B4)** → ручной пункт.
- [x] VK: ссылки на `PUBLIC_SITE_URL` воркера — исправлено (B6), тест есть. Сам `PUBLIC_SITE_URL` воркера — ручной пункт.
- [x] Payload `serverURL = getPublicSiteUrl()`; CSRF по умолчанию разрешает `serverURL`. Прод-админка работает на новом домене; на старом хосте и на `*.vercel.app` cookie-вход будет отклонён — это нормально, после редиректа старый хост в админку не попадёт. CORS не настроен и не нужен (админка same-origin). На превью `serverURL` = URL превью, админка там работает.
- [ ] `/api/health` и алерты: в коде ссылок нет; uptime-проверка `hht-health` смотрит на старый хост → ручной пункт.

### Тесты

- [x] Тесты на чужой хост: `seo.test.ts` (sitemap, robots), e2e share-metadata (canonical, hreflang, og, sitemap), тест воркера (письма, заголовки, VK, owner kit), e2e subscriptions (подтверждение и welcome-выпуск). Три новых теста воркера падают на старом коде (проверено откатом файла).
- [x] Тест `List-Unsubscribe` + `List-Unsubscribe-Post`: воркер и e2e (с реальным one-click POST).
- [x] Прогон 2026-10-01 на ветке: `pnpm check` — shared 75/75, worker 111/111, web 179/179; `pnpm format:check` чисто; `pnpm test:e2e` — **61 passed** (локальный Postgres, `seed:public-feed`).

## 4. T060 и T064

### T060 (006, quickstart §8)

| Подпункт                                                                           | Группа | Статус                                                                                                         |
| ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| SPF                                                                                | код    | ✓ `send.hht.rarediseasedigest.org` → `send.forge.rmta.net` (TXT `v=spf1 … ~all`, MX `feedback.forge.rmta.net`) |
| DKIM                                                                               | код    | ✓ TXT `resend._domainkey.hht.rarediseasedigest.org` (`p=MIGf…`), `d=` совпадёт с доменом `From`                |
| DMARC                                                                              | код    | ✗ записи нет (B3)                                                                                              |
| DNSSEC (не в T060, но заявлен)                                                     | код    | ✓ DS на `rarediseasedigest.org`, ответы с `AD=true`                                                            |
| `RESEND_FROM_EMAIL` на этом домене                                                 | код    | ✓ Production (Vercel); ✗ воркер (B1)                                                                           |
| Open/click tracking выключены, Contacts пуст                                       | руками | §5 шаг 2                                                                                                       |
| Вебхук только `email.bounced`/`email.complained` + `RESEND_WEBHOOK_SECRET` на вебе | руками | ✗ секрета нет (B4)                                                                                             |
| `VK_COMMUNITY_TOKEN` только на воркере                                             | код    | ✓ нет ни в одной среде Vercel; на воркере тоже нет. Нужен ли — зависит от `vkCommunityId` (§5 шаг 5)           |
| Чтение на телефоне в Gmail, Mail.ru, Yandex, Apple Mail (SC-005)                   | руками | §5 шаг 12                                                                                                      |
| Кнопка отписки клиента → `unsubscribed`                                            | руками | код покрыт e2e (one-click POST), реальный клиент — §5 шаг 7                                                    |

T060 **не отмечен**: ручная часть не пуста.

### T064 (005, quickstart §7, шаги 1–6)

| Шаг                                                                     | Группа   | Статус                                                                                                        |
| ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| 1. `AI_GATEWAY_API_KEY` на Production и Preview                         | код      | ✓ Vercel env: обе цели                                                                                        |
| 2. Мерж, схема на проде                                                 | код      | ✓ прод отдаёт текст выпусков (`/api/public/projects/hht/issues` — у всех выпусков есть `excerpt`)             |
| 3. Исторические выпуски 2026-08-31 (id 11) и 2026-09-22 (id 13) `ready` | код      | ✓ оба в списке с текстом                                                                                      |
| 3. Ручная вычитка текста (SC-004)                                       | руками   | §5 шаг 11                                                                                                     |
| 4. `hht`: weekly, monday, 04 UTC                                        | код      | ✓ `/api/health`: `schedule: weekly`; выпуск 15 опубликован в понедельник 2026-09-28 04:01:33 UTC              |
| 4. `audienceContext` заполнен                                           | руками   | в публичном API его нет — глянуть в админке                                                                   |
| 5. `/api/health` 200 всю неделю                                         | частично | ✓ 200 на 2026-10-01 05:15 UTC, `stale: false`; непрерывность — по отсутствию алертов `hht-health` (§5 шаг 11) |
| 6. Первый понедельник без ручных действий                               | код      | ✓ execution `hht-monitor-worker-f74vl` от Scheduler `hht-monitor-hourly` в 04:00:03 → выпуск 15 в 04:01:33    |
| 6. Второй понедельник (SC-003)                                          | ждать    | 2026-10-05 04:00 UTC                                                                                          |

T064 **не отмечен**: вычитка SC-004, `audienceContext` и второй понедельник.

## 5. Ручной чеклист (по порядку)

1. **Cloudflare → DNS `rarediseasedigest.org`** — добавить TXT `_dmarc.hht` = `v=DMARC1; p=none; rua=mailto:<твой адрес>` (B3). Проверка: `https://cloudflare-dns.com/dns-query?name=_dmarc.hht.rarediseasedigest.org&type=TXT` с `accept: application/dns-json` возвращает запись.
2. **Resend → Domains → `hht.rarediseasedigest.org`**: выключить Open tracking и Click tracking. **Audiences/Contacts**: пусто. **Webhooks → Add**: URL `https://hht.rarediseasedigest.org/api/webhooks/resend`, события только `email.bounced` и `email.complained`; скопировать Signing secret.
3. **Vercel → hht-research-platform-web → Settings → Environment Variables**: добавить `RESEND_WEBHOOK_SECRET` (Production, Sensitive) = секрет из шага 2. Redeploy Production. Проверка: в Resend «Send test event» → ответ `200`, а не `400 Not configured`.
4. **GCP → Monitoring → Uptime checks → `hht-health`**: Host → `hht.rarediseasedigest.org`, путь `/api/health`. Сделать **до** шага 6, иначе проверка упадёт на редиректе.
5. **Решить Q1 (архив)**, затем **GCP → Cloud Run → Jobs → `hht-monitor-worker`** (до этого смержить ветку, чтобы задеплоился исправленный воркер):
   ```bash
   printf '%s' '<PAYLOAD_SECRET из Vercel Production>' | gcloud secrets create payload-secret --data-file=- --project=hht-research-platform
   printf '%s' '<RESEND_API_KEY>' | gcloud secrets create resend-api-key --data-file=- --project=hht-research-platform
   # сервисному аккаунту джоба — roles/secretmanager.secretAccessor на оба секрета
   gcloud run jobs update hht-monitor-worker --project=hht-research-platform --region=europe-west1 \
     --update-env-vars='PUBLIC_SITE_URL=https://hht.rarediseasedigest.org,RESEND_FROM_EMAIL=HHT Digest <news@hht.rarediseasedigest.org>' \
     --update-secrets='PAYLOAD_SECRET=payload-secret:latest,RESEND_API_KEY=resend-api-key:latest'
   ```
   `VK_COMMUNITY_TOKEN` — только если у проекта в админке заполнен `vkCommunityId` (тогда тем же способом, секрет `vk-community-token`). Проверка: следующий часовой прогон без ERROR `subscription sweep skipped`.
6. **Vercel → Settings → Domains → `hhtnews.growtomiddle.dev`**: сейчас домен обслуживает сайт (`200`), а не редиректит (B5). Поставить «Redirect to `hht.rarediseasedigest.org`», 308. Проверка — шаг 9.
7. **Тест доставки** (адреса — твои тестовые ящики Mail.ru, Yandex, Gmail, iCloud). Для каждого: подписаться на `https://hht.rarediseasedigest.org/ru/projects/hht` → письмо подтверждения во «Входящих», не в спаме → ссылка подтверждения открывает «Адрес подтверждён» → welcome-выпуск пришёл (если последний выпуск моложе 14 дней) → в Gmail и Apple Mail видна нативная кнопка «Отписаться» → нажать на одном ящике и убедиться в админке, что статус `unsubscribed`.
8. **Gmail → письмо → ⋮ → Show original**: `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS` (после шага 1); в `DKIM-Signature` `d=hht.rarediseasedigest.org` = домен `From`.
9. **Редиректы** (из терминала):
   ```bash
   for u in https://rarediseasedigest.org/ https://www.rarediseasedigest.org/ \
     https://hhtnews.growtomiddle.dev/ru/projects/hht/issues/15; do
     curl -s -o /dev/null -w '%{http_code} %{redirect_url}  <- '"$u"'\n' "$u"; done
   ```
   Все три — `308` на `https://hht.rarediseasedigest.org/…` с тем же путём.
10. **Превью ссылки** `https://hht.rarediseasedigest.org/ru/projects/hht/issues/15` в Telegram и WhatsApp: картинка и заголовок есть, домен в карточке новый. В Telegram сначала откройте страницу в браузере (кэш перевода, 005 §7 шаг 8).
11. **T064**: вычитать текст выпусков 11 и 13 (SC-004); в админке у проекта `hht` заполнен `audienceContext`; нет инцидентов `hht-health` за неделю; 2026-10-05 после 04:00 UTC — новый выпуск без ручных действий (SC-003). После этого отметить T064.
12. **Почта песочницы на телефоне (SC-005)**: тестовый выпуск в Gmail, Mail.ru, Yandex, Apple Mail на телефоне с выключенной загрузкой ссылок/картинок — текст читается целиком. После шагов 1–9 и 12 отметить T060.
13. **Google Search Console** (не блокер): добавить Domain property `rarediseasedigest.org` (TXT в Cloudflare), отправить `https://hht.rarediseasedigest.org/sitemap.xml`; для старого домена — Change of Address.

## 6. Риски

- **R1 — архив в первой рассылке** (B2). Самый опасный пункт: 7 писем на подписчика в первый же час.
- **R2 — Preview делит с Production ключ Resend и отправителя.** Гейт закрыт кодом, но любое будущее место отправки в обход `subscriberMailEnabled` снова откроет дыру. Надёжнее: отдельный ключ Resend для Preview с правом только на песочницу, или убрать `RESEND_*` из Preview.
- **R3 — Neon-ветки превью копируют прод** вместе с реальными адресами подписчиков. Сейчас с превью им не пишется (см. §2), но данные там лежат.
- **R4 — админ-кит постов даёт ссылки на `/en/` даже для русских постов** ([posts route](../../apps/web/src/app/api/admin/digests/[id]/posts/route.ts)); owner kit в письме сделан так же ради совпадения с админкой. VK-пост использует язык текста. Не связано с доменом, но ссылка в русском чате ведёт на английскую страницу.
- **R5 — старые ссылки**: письма и посты, разосланные раньше со старым хостом, живут на редиректе `hhtnews.growtomiddle.dev`. Домен `growtomiddle.dev` нельзя отпускать, пока ссылки в обращении.
- **R6 — ERROR каждый час**: пока у воркера нет `PAYLOAD_SECRET`, sweep пишет ERROR `subscription sweep skipped…` в каждом прогоне, и log-алерт `hht-worker-errors` шумит.

## 7. Открытые вопросы

- **Q1 (блокер B2).** Что делать с прошлыми выпусками при включении почты воркера? Варианты: (а) один раз проставить `subscriberFanoutAt` всем выпускам, кроме тех, что ты хочешь разослать (запись в прод, сделаю по твоему OK); (б) правка кода: fan-out только для выпусков моложе N дней (например, 14, как у welcome-выпуска) — это изменение поведения спеки 006, лучше через Spec Kit. Нужно ли отправить выпуск 15 (2026-09-28)?
- **Q2.** Язык этого документа: по твоей задаче — русский, хотя обычно файлы в репо на английском. Перевести?
- **Q3.** `.env.example` мне недоступен по настройкам. Предлагаемые правки: комментарий у `PUBLIC_SITE_URL` «Production: https://hht.rarediseasedigest.org; worker needs the same value» и у `RESEND_FROM_EMAIL` «Production: HHT Digest <news@hht.rarediseasedigest.org>; set on web and worker; Preview mails the owner only».
