# HHT Research Platform

## EN

HHT Research Platform is an open-source tool that automatically monitors PubMed, ClinicalTrials.gov, and RSS sources for a research topic you define, using AI to summarize and rank new findings in a public digest feed — no registration needed. The platform itself is topic-agnostic; its first project tracks Hereditary Hemorrhagic Telangiectasia (HHT) for the Cure HHT community, with an interface in English, German, Turkish, Russian, and Ukrainian.

## DE

HHT Research Platform ist ein Open-Source-Tool, das automatisch PubMed-, ClinicalTrials.gov- und RSS-Quellen zu einem von Ihnen festgelegten Forschungsthema überwacht und neue Erkenntnisse per KI zusammenfasst und in einem öffentlichen Digest-Feed einordnet — ganz ohne Registrierung. Die Plattform selbst ist themenunabhängig; das erste Projekt begleitet die Hereditäre Hämorrhagische Teleangiektasie (HHT) für die Cure-HHT-Community, mit einer Oberfläche auf Englisch, Deutsch, Türkisch, Russisch und Ukrainisch.

## TR
HHT Research Platform, sizin belirlediğiniz bir araştırma konusu için PubMed, ClinicalTrials.gov ve RSS kaynaklarını otomatik olarak izleyen; yeni bulguları yapay zekâyla özetleyip önem derecesine göre sıralayarak herkese açık bir bültende yayınlayan açık kaynaklı bir araçtır — kayıt gerektirmez. Platformun kendisi konudan bağımsızdır; ilk proje, Cure HHT topluluğu için Herediter Hemorajik Telenjiektazi'yi (HHT) izlemektedir ve arayüz İngilizce, Almanca, Türkçe, Rusça ve Ukraynaca olarak sunulmaktadır.

## RU
HHT Research Platform — open-source инструмент, который автоматически отслеживает источники PubMed, ClinicalTrials.gov и RSS по заданной вами теме, суммаризирует новые находки через AI и ранжирует их по важности в открытой ленте дайджестов — без регистрации. Сама платформа не привязана к конкретной теме; первый проект на ней — мониторинг наследственной геморрагической телеангиэктазии (HHT) для сообщества Cure HHT, с интерфейсом на английском, немецком, турецком, русском и украинском языках.

## UK
HHT Research Platform — це інструмент із відкритим кодом, який автоматично відстежує джерела PubMed, ClinicalTrials.gov та RSS за темою, яку ви визначаєте, узагальнює нові знахідки за допомогою AI і ранжує їх за важливістю у відкритій стрічці дайджестів — без реєстрації. Сама платформа не прив'язана до конкретної теми; перший проєкт на ній — моніторинг спадкової геморагічної телеангіектазії (HHT) для спільноти Cure HHT, з інтерфейсом англійською, німецькою, турецькою, російською та українською мовами.

## Short

Topic-agnostic research monitoring: configure sources in Payload Admin, run a Dockerized worker to fetch → dedupe → classify → summarize → publish digests, and read a public locale-prefixed feed.

## Stack

- `apps/web` — Next.js 16 + Payload CMS 3 + Mantine + next-intl (Vercel)
- `apps/worker` — Cloud Run Job monitoring pipeline
- `packages/shared` — Zod types, dedupe, schedule helpers

See `specs/001-research-monitoring-mvp/` for the full Spec Kit plan, data model, and contracts.

## Setup

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL, PAYLOAD_SECRET, etc.
docker compose up -d   # optional local Postgres
pnpm --filter @hht/shared build
pnpm --filter @hht/web dev
```

Admin: `/admin` · Public: `/en` (also `de`, `tr`, `ru`, `uk`)

Seed a demo public feed:

```bash
pnpm --filter @hht/web seed:public-feed
```

Manual worker run:

```bash
pnpm --filter @hht/worker start
```

Docker worker:

```bash
docker build -t hht-monitor-worker -f apps/worker/Dockerfile .
docker run --env-file .env hht-monitor-worker
```

## Owner setup (SC-001)

1. Open `/admin` and sign in.
2. Create a Research Project (name, slug, description, keywords).
3. Add at least a PubMed monitored source; optionally ClinicalTrials.gov and RSS.
4. Set schedule (`daily` / `weekly` / `monthly`) and leave monitoring active.
5. Optionally enable email notification.
6. Target: complete this under 15 minutes.

Details: [`specs/001-research-monitoring-mvp/quickstart.md`](specs/001-research-monitoring-mvp/quickstart.md).

## Quality gates

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm --filter @hht/web build
pnpm test
pnpm test:e2e
```

## License

MIT
