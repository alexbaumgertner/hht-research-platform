# Roadmap 2026 Q4 — HHT Research Platform

_Written 2026-09-22. Scope: 2026-09-22 → 2026-12-31. Planning document only — no code changes._

## 0. The quarter in one paragraph

**Hypothesis under test:** "someone will use this and come back."
**Success on 2026-12-31 (falsifiable):**

1. The digest publishes itself, with no manual intervention, **4 weeks in a row**.
2. **50 confirmed (double opt-in) subscribers** who arrived from patient chats (attributed by `src`).
3. **1 physician** has given **written** feedback on the content.

Everything below is ordered by how directly it moves one of those three numbers. Anything that doesn't
move them is listed under [Not doing this quarter](#3-not-doing-this-quarter).

**Capacity assumption:** 3–4 evenings (2–3 h each) per week → about **36 usable evenings** by
Dec 24, with a 15% buffer already taken out. The plan is sized to fit exactly that; if the real
number is lower, cut from the bottom of the spec queue (see §5).

---

## 1. Audit summary

The audit covered the code at `0938d89`, the production GCP project (`gcloud run jobs executions list`,
Cloud Logging, `gcloud scheduler jobs list`), the public production API
(`https://hht-research-platform-web.vercel.app/api/public/...`), and Vercel runtime logs. No secrets
were read, and nothing in production was changed.

### 1.1 Headline finding — the pipeline did not stop; it has been failing silently for 22 days

- Cloud Scheduler `hht-monitor-hourly` is `ENABLED`. The Cloud Run Job has run **every hour**:
  619 executions since 2026-08-27, **615 succeeded (exit 0)**.
- The real project `hht` (id 2) **runs once a day** and finishes in about 11 s. The seed project
  `hht-research` (id 3) **runs every hour** because its watermark never advances.
- The last real digest for `hht` was **2026-08-31 17:02 UTC**. The "1 September" digest visible on
  the site belongs to the **seed** project `hht-research` (2026-09-01 20:48 UTC). It was created by
  `seed-public-feed.ts`, not by the worker.
- **Root cause (confirmed in Vercel runtime logs):** every `POST /api/publications` from the worker
  gets **HTTP 400**: `monitoredSource: This relationship field has the following invalid relationships: 4 0`.
  - Commit `984ec9b` (2026-08-30) started sending `monitoredSource: source.id`
    ([runProject.ts](../apps/worker/src/pipeline/runProject.ts)). The worker passes that id as a
    string: `id: String(s.id)` in [client.ts:104](../apps/worker/src/cms/client.ts:104).
  - That commit first reached production with the **first CI-built image (2026-08-31 21:00 UTC)**,
    from [deploy-worker.yml](../.github/workflows/deploy-worker.yml). The last good run (17:02 UTC)
    used the manually built image from 2026-08-28, which did not send the field.
  - The exact trigger is still to be proven with a failing test: either the string id versus the
    numeric Postgres id, or relationship validation running under worker access, since
    `MonitoredSources.read = isWorkerOrAdmin` ([MonitoredSources.ts](../apps/web/src/collections/MonitoredSources.ts)).
- **Why the data is lost, not just delayed:** the 400 is thrown _after_ classify + summarize, inside
  the per-source `try` block. The PubMed source fails on its first new item. ClinicalTrials.gov has
  0 new items, so it "succeeds". The run then resolves to `completed_partial_failure` and **advances
  the watermark for all sources**
  ([publish.ts `resolveRunStatus`](../apps/worker/src/pipeline/publish.ts), as spec FR-020 requires).
  As a result, the PubMed papers from those windows are skipped permanently. PubMed has 11 new HHT
  papers with EDAT on or after 2026-09-01 (checked live via E-utilities).
- **Why nobody knew:**
  1. Errors are caught per project ([index.ts](../apps/worker/src/index.ts)) and per source
     ([runProject.ts](../apps/worker/src/pipeline/runProject.ts)). They are written only to
     `monitoring-runs.sourceResults[].error` in the CMS, which is auth-only, and **never to stdout**.
     Cloud Logging shows nothing but `due projects` / `complete`.
  2. The job exits 0, so Cloud Run and Cloud Scheduler stay green. No alert policy, no heartbeat.
  3. FR-010 ("no empty digest") makes "broken" look the same as "no news this week".
  4. The public site shows no "last checked" date. The owner email only fires on success.
  5. The seed project's hourly failures are noise. They also cost 2 LLM calls per candidate every hour.

### 1.2 Observations checked against code

| #   | Observation (from outside)                                      | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Last digest 1 Sep, runs stopped, nobody noticed                 | **Partly wrong.** Runs never stopped. Publication writes fail with 400 (see §1.1). The 1 Sep digest is seed data; the last real digest is 31 Aug. "Nobody noticed" is **confirmed**, for the five reasons above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2   | Two duplicate projects `hht` and `hht-research` on home         | **Confirmed.** `hht-research` / "HHT Research" is created by [seed-public-feed.ts](../apps/web/src/scripts/seed-public-feed.ts), which ran against the production DB at least twice. It is `monitoringStatus: active` with 3 `example.com` RSS sources. Its 8 public "materials" are fake ("Seed data is not a real study", `pubmed.ncbi.nlm.nih.gov/seed-pubmed/`), which is a **trust problem on a medical site**. E2E tests ([public-feed.spec.ts](../apps/web/tests/e2e/public-feed.spec.ts)) depend on this slug locally, which is fine. It must not exist in production.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | `importance` degenerate                                         | **Confirmed.** 24/24 public `hht` materials display "high"; the UI collapses critical and high ([materials.ts `collapseImportance`](../apps/web/src/lib/materials.ts)), so the "only high importance" switch filters nothing. Prompt causes ([ai.ts `summarizeAndRank`](../apps/worker/src/pipeline/ai.ts)): (a) absolute 4-level scale with no rubric or anchors; (b) the persona is "specialists monitoring HHT", so everything on-topic in a rare disease looks important; (c) study design is never passed in, although PubMed `PublicationType` is available in efetch XML; (d) only the **first** `<AbstractText>` is parsed ([pubmed.ts](../apps/worker/src/adapters/pubmed.ts), non-global regex), so for structured abstracts the model sees BACKGROUND only and rates the topic, not the evidence; (e) each item is scored in isolation, with no relative ranking; (f) `importance` comes before `summary` in the schema, so the model commits to a rating before it reads and summarizes. |
| 4   | 21-item digest is a bootstrap dump; Digest has no text summary  | **Confirmed.** `bootstrapLookbackDays` defaults to 30 ([ResearchProjects.ts](../apps/web/src/collections/ResearchProjects.ts)). [Digests.ts](../apps/web/src/collections/Digests.ts) has only `project/run/publishedAt/publications`. Moreover, since spec 002 the **digest is invisible to readers**: the feed is a flat list of up to 200 materials, and the digest is just a publishing gate (002 clarification Q1). There is no "issue" to share or email.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5   | Trials rendered as Publications                                 | **Confirmed.** [clinicaltrials.ts](../apps/worker/src/adapters/clinicaltrials.ts) keeps only `nctId`, `briefTitle` and `briefSummary`: no phase, status, locations, eligibility or dates. The summarizer forces Objective/Methods/**Results** onto a registry entry, which invites invented "results". Dedupe by NCT id ([dedupe.ts](../packages/shared/src/dedupe.ts)) means a **status change (e.g. starts recruiting) never resurfaces**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | One register (physician); translation only changes language     | **Confirmed.** [translate.ts](../apps/worker/src/pipeline/translate.ts) preserves the 5 physician sections. The summary prompt addresses "specialists". There is no plain-language field anywhere in the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7   | No subscribe form, RSS or OG; email only to owner               | **Confirmed.** Also: the sender defaults to `onboarding@resend.dev` ([digestEmail.ts](../apps/worker/src/notify/digestEmail.ts)), Resend's sandbox sender, which only delivers to the account owner. So **subscriptions need a verified domain**, which moves the domain from Stage 3 to Stage 1. The feed link is hardcoded to `/en/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | No medical disclaimer / "AI-generated" label                    | **Confirmed.** Nothing in `apps/web/messages/*.json` or the components.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | Developer-language copy                                         | **Confirmed, and worse.** The header "Research Monitoring" is hardcoded in English for every locale ([layout.tsx](../apps/web/src/app/[locale]/layout.tsx)). The public tree has **no `metadata`/`generateMetadata` at all**: no `<title>`, no description, no OG. **Links pasted into VK/WhatsApp/Telegram show no preview.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | No search, no organ/topic tags; spec only has importance filter | **Partly wrong.** Spec 002 shipped client-side search over title + preview ([MaterialsFeed.tsx](../apps/web/src/components/MaterialsFeed.tsx), [materials.ts `filterMaterials`](../apps/web/src/lib/materials.ts)) and a source-category filter. **No organ/topic tags: confirmed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 11  | `*.vercel.app`, no analytics                                    | **Confirmed.** Job env `PUBLIC_SITE_URL=https://hht-research-platform-web.vercel.app`. No analytics dependency in [apps/web/package.json](../apps/web/package.json).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### 1.3 Additional findings not in the original list

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **No dates on PubMed/CT items.** Neither adapter sets `publishedOrUpdatedAt`. All 23 PubMed/CT materials in `hht` have `date: null`, so "newest first" sorting ([`sortMaterialsByDateDesc`](../apps/web/src/lib/materials.ts)) is meaningless and readers see no dates.                                                                                                                                                                               |
| N2  | **Structured abstracts truncated** to the first section (see #3d). This hurts summary accuracy, not just importance: Methods and Results are summarized from Background.                                                                                                                                                                                                                                                                              |
| N3  | **Batch overflow is lost.** `clampBatch` cuts to 50 but the watermark still advances. This contradicts the 001 edge case "remaining items wait for a subsequent run".                                                                                                                                                                                                                                                                                 |
| N4  | **Orphan `running` runs.** The [manual-run endpoint](../apps/web/src/endpoints/manualRun.ts) creates a `running` record that no worker ever picks up (`MANUAL_RUN_ID` isn't implemented). A job killed by the 15 min task timeout also leaves `running` forever. There is no reaper.                                                                                                                                                                  |
| N5  | **Schedule drifts.** `isProjectDue` = `lastSuccessfulRunAt + interval` on an hourly tick ([schedule.ts](../packages/shared/src/schedule.ts)), so a weekly issue slides about 1 h/week and has no fixed weekday. The logs show `hht` drifting 17:02 → 18:01 → … → 12:01.                                                                                                                                                                               |
| N6  | **Translation is pre-generated at publish** (`TRANSLATE_ON_PUBLISH` defaults to on, [runProject.ts](../apps/worker/src/pipeline/runProject.ts)). This contradicts 001 FR-017 and Constitution III/VI ("on first request"). There is no lazy path: a failed pre-generation means English fallback forever. [translations.ts](../apps/web/src/lib/translations.ts) and [translationFallback.ts](../apps/web/src/lib/translationFallback.ts) are unused. |
| N7  | **Accessibility from Russia is unverified.** The primary audience is Russian-speaking; availability of `*.vercel.app` and Vercel IPs from Russian ISPs without VPN has been unreliable. **Verify before posting in chats.** Mitigation regardless: the email carries the **full issue text**, not just a link.                                                                                                                                        |
| N8  | **Subscriber emails for a disease newsletter are health-adjacent personal data** (GDPR Art. 9 territory; 152-FZ localization questions for Russian citizens). This needs data minimization and a privacy note before collecting the first address (see open questions).                                                                                                                                                                               |

### 1.4 Spec `001-research-monitoring-mvp` — declared vs. actually working

All 78 tasks are ticked. What actually holds in production:

| Requirement                                               | Status                                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-004 runs automatically / **SC-002** publishes a digest | **Broken in prod since 2026-08-31** (§1.1). No test covers the worker → Payload REST contract.                                                                                |
| FR-005 "new since last successful run"                    | Implemented, but **loses items** on source-level failure (FR-020 wording) and on batch overflow (N3). The edge case "gap included once, not permanently lost" is **not met**. |
| FR-008 summary + importance                               | Implemented. The input is truncated (N2) and importance is degenerate (#3). The edge case "limited source text → say so rather than invent" is **not in the prompt**.         |
| FR-009 / FR-011 public chronological digest feed          | **Changed by 002**: digests are no longer visible and the feed is flat. "Chronological" is broken by N1.                                                                      |
| FR-012 / **SC-007** filter by importance level            | **Replaced by 002** with a 2-level "only high" switch, which is a no-op with the current data.                                                                                |
| FR-013 open publication → summary + source link           | Done (spec 003).                                                                                                                                                              |
| FR-015 / SC-006 owner email ≤10 min                       | Code exists. It uses the Resend sandbox sender and the link is always `/en/`. Unverified in prod.                                                                             |
| FR-016 five locales                                       | UI yes. The header is hardcoded in English; no localized metadata.                                                                                                            |
| FR-017 / SC-004 on-demand translation                     | **Not implemented as specified** (N6). Pre-generation instead.                                                                                                                |
| FR-021 home lists projects with ≥1 digest                 | Works, which is exactly why the seed project is visible.                                                                                                                      |
| FR-022 pause/resume                                       | Works.                                                                                                                                                                        |
| Manual trigger (optional)                                 | A stub that produces orphan runs (N4).                                                                                                                                        |

Specs 002 and 003 exist, so **new spec numbering starts at `004`**.

---

## 2. Findings → impact → stage

| #   | Problem                                          | Evidence                                       | Impact on Q4 criteria                              | Stage                  |
| --- | ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------- | ---------------------- |
| F1  | Publication writes 400 on `monitoredSource`      | Vercel logs; `client.ts:104`; commit `984ec9b` | Criterion 1 impossible                             | 0 (hotfix)             |
| F2  | Errors never logged, exit 0, no alert/heartbeat  | `index.ts`, `runProject.ts`                    | Criterion 1 fails silently again                   | 0 (spec 004)           |
| F3  | Failed source window skipped forever             | `publish.ts resolveRunStatus`, FR-020          | Missed papers, loss of trust                       | 0 (spec 004)           |
| F4  | Seed project + fake medical items in prod        | `seed-public-feed.ts`, public API              | Trust; the first patient visit sees fake studies   | 0 (hotfix)             |
| F5  | No dates; truncated abstracts                    | `pubmed.ts`, `clinicaltrials.ts`               | Accuracy; unusable ordering                        | 0 (hotfix)             |
| F6  | Orphan `running` runs; schedule drift            | `manualRun.ts`, `schedule.ts`                  | The streak can't be measured cleanly               | 0 (spec 004)           |
| F7  | No shareable issue; digest has no summary        | `Digests.ts`, 002 clarification                | Nothing to post in chats or email                  | 1 (spec 005)           |
| F8  | No metadata/OG, English-only chrome, dev copy    | `[locale]/layout.tsx`, `messages/*.json`       | Links in chats have no preview → no clicks         | 1 (spec 005)           |
| F9  | No disclaimer / AI label                         | messages, components                           | Can't responsibly post to patients                 | 1 (spec 005)           |
| F10 | No subscription; sandbox sender; no domain       | `digestEmail.ts`                               | Criterion 2 impossible                             | 1 (spec 006)           |
| F11 | No analytics / attribution                       | `package.json`                                 | Criterion 2 "from patient chats" not provable      | 1 (spec 006)           |
| F12 | Importance degenerate                            | `ai.ts`, public data 24/24 high                | No "what matters this week"; physician credibility | 2 (spec 007)           |
| F13 | Trials have no trial fields; status changes lost | `clinicaltrials.ts`, `dedupe.ts`               | Patients' #2 need unmet                            | 2 (spec 008)           |
| F14 | Physician register only                          | `ai.ts`, `translate.ts`                        | Patients can't read it → no return visits          | 1 (min) / 2 (spec 009) |
| F15 | No organ/topic tags                              | `materials.ts`, schema                         | Physician usefulness; navigation                   | 3 (spec 010, stretch)  |
| F16 | Developer-first home/README; no methodology      | `README.md`, `messages/*.json`                 | Cure HHT positioning, physician trust              | 3 (spec 011)           |
| F17 | RF accessibility unknown                         | — (external)                                   | Could zero out criterion 2                         | 1 (check)              |
| F18 | Pre-generated translations vs FR-017             | `runProject.ts`                                | Spec/constitution drift                            | 1 (amend in 005)       |

---

## 3. Not doing this quarter

| Not doing                                                                                                        | Why                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-tenancy, owner self-registration, project-creation UX, topic templates, per-project domains/senders/themes | No second project and no first reader. Every hour here is an hour not spent on criteria 1–3. Topic-agnosticism is kept as an internal constraint only (§4).       |
| New source types (bioRxiv/medRxiv, Europe PMC, Scholar, VK/Telegram scraping)                                    | Constitution II (≤3 sources). The existing three already produce more than the pipeline can reliably publish. More input doesn't change "will someone come back". |
| RAG, "ask the knowledge base", chat/Q&A bot                                                                      | Constitution II; high medical-advice risk; zero effect on subscribers.                                                                                            |
| Telegram/VK/WhatsApp bots and auto-posting                                                                       | The owner is admin of those chats, so a manual post costs 5 minutes per week. Automation matters at thousands of readers, not 50.                                 |
| Accounts, personalization, per-organ subscription preferences                                                    | Constitution IV. Subscription = email + locale + source attribution only.                                                                                         |
| Trial eligibility matching ("am I eligible?")                                                                    | Medical-advice risk. We show criteria and a contact path, never a verdict.                                                                                        |
| Physician product (protocol library, evidence tables by organ, CME)                                              | Audience #2. This quarter only needs one physician's written feedback, which comes from spec 007's calibration set plus the methodology page.                     |
| New content work in de/tr/uk (patient layer, issue intros)                                                       | Russian-speaking patients first. The UI stays in five locales (Constitution VI); new patient-facing text is generated in ru + en only.                            |
| Server-side / vector search, pagination beyond 200                                                               | About 24 items now, roughly 100 by December. Client-side search is enough; revisit past 200.                                                                      |
| Editorial approval queue before publishing                                                                       | Contradicts criterion 1 ("publishes itself"). Safety comes from prompt rules, disclaimers and a retract action instead (see open question Q8).                    |
| Paid tiers (Vercel Pro, Neon paid, Resend paid), stack or framework migrations, visual rebrand/logo              | Constitution III; nothing in the criteria needs it. Resend free tier (100/day) covers 50 subscribers.                                                             |
| On-site comments/community features                                                                              | The community already lives in the chats.                                                                                                                         |
| Retrofitting FR-017 lazy translation                                                                             | Pre-generation works and is cheap with `gpt-4o-mini`. Amend the spec/constitution to match reality instead (Q11).                                                 |

---

## 4. Keeping "topic-agnostic" as an internal constraint only

Rules for every spec from 004 onward. Each spec's `plan.md` answers them in its Constitution Check:

1. **Data, not code.** No disease names or organ lists in `apps/*/src`. HHT-specific inputs live on
   the `research-projects` record or in project-scoped collections: keywords, audience/disease
   context for prompts, topic taxonomy (spec 010), disclaimer addendum. Cheap enforcement: a CI grep
   that fails on `/hht|telangiect|osler/i` in `apps/*/src` outside seeds, tests and `messages/`.
2. **Every new entity carries `project`.** Subscriber, Trial, TopicTag, Issue summary. This costs
   nothing now and keeps the door open.
3. **Prompts are parameterized** by project fields (`name`, `keywords`, a new `audienceContext`),
   never by literals.
4. **Single-project presentation mode.** Add a `PRIMARY_PROJECT_SLUG` env var. When it's set, `/[locale]`
   renders that project's landing (HHT-branded copy comes from the project record) instead of a
   project list. The multi-project list stays in code but isn't the front door.
5. **One test per spec:** "a second project with different keywords doesn't need a code change"
   is a unit-level assertion, not a feature.
6. **Explicitly out:** tenant isolation, per-project auth/roles, per-project sender domains,
   template gallery. Revisit only after criterion 2 is met.

---

## 5. Stages

Dates assume about 3.5 evenings/week. Each estimate is in evenings (2–3 h).

### Stage 0 — Production hygiene (2026-09-23 → 2026-10-02, about 6 evenings)

**Goal:** the pipeline publishes real items again, can't fail silently, and the site shows nothing fake.

Work:

- **H1 (hotfix, 1 ev)** Reproduce the `monitoredSource` 400 with a failing contract test
  (worker payload → Payload validation), fix it, deploy. Write a 1-page incident note in `docs/incidents/`.
- **H2 (hotfix, 0.5 ev)** Production cleanup: pause, then delete the `hht-research` project with its
  sources, publications, digests and runs. Add a seed guard so it refuses a non-localhost DB unless
  `SEED_ALLOW_REMOTE=1`, and set the seed project to `paused` by default.
- **H3 (hotfix, 1 ev)** PubMed: all `<AbstractText>` sections with labels, pub/EDAT date,
  `PublicationType[]` (feeds spec 007). CT: `lastUpdatePostDate` → `publishedOrUpdatedAt`. Backfill
  the existing 24 items.
- **H4 (ops, 0.5 ev)** After H1–H3: reset `hht.lastSuccessfulRunAt` to `2026-08-31T17:00Z` so the
  lost window is re-fetched once, which yields one catch-up digest.
- **Spec 004 `pipeline-health` (3 ev)**, see §6.

**Done when:**

- A new `hht` digest exists containing the September PubMed papers, with dates and full abstracts.
- The public home shows exactly one project, and no `example.com` / `seed` URL is publicly reachable.
- **Failure drill:** a deliberately broken run (invalid AI key on a one-off execution) produces an
  alert email within 1 h, and a missing successful run for more than 26 h produces an alert.
- A source-level failure no longer advances that source's watermark (unit test).

**Depends on:** nothing. This comes first.

### Stage 1 — First live reader (2026-10-03 → target 2026-10-19, hard stop 2026-10-26, about 11 evenings)

**Goal:** one Russian issue reaches the chats and at least one person who isn't the owner confirms a subscription.

Work:

- **Chore (1 ev, start in Stage 0 week):** buy the domain, point it at Vercel, verify it in Resend
  (SPF/DKIM/DMARC), update `PUBLIC_SITE_URL` on Vercel and the Cloud Run Job. **Ask 2–3 chat members
  to open the site from Russia without VPN** (F17).
- **Spec 005 `digest-issue` (4 ev)** and **Spec 006 `email-subscriptions` (5 ev)**, see §6.
- Switch `hht` to a **weekly** cadence anchored to one weekday (from 004). The 4-week streak counter
  starts with the first automatic issue.
- **Launch (1 ev):** write the chat post (ru), post in 2 chats first (e.g. Telegram + VK), watch
  for 1 week, then post in the other two.

**Done when:**

- The weekly issue page renders in ru with an intro, one plain-language line per item, a
  disclaimer and an AI label. The link preview shows a title, description and image in Telegram,
  VK and WhatsApp.
- The subscribe → confirm → receive → one-click unsubscribe loop works in production, with `src`
  recorded.
- **≥1 confirmed subscriber who isn't the owner, from a chat link.**

**Depends on:** Stage 0; the domain (blocks 006 email delivery).

**Risk:** 17 evenings for Stages 0 + 1 is tight for mid-October. The fallback order is to ship 005
first and post the issue link. The subscribe form follows within a week. Don't cut 005's
disclaimer or OG to save time.

### Stage 2 — Accuracy and trust (2026-10-27 → 2026-11-30, about 13 evenings)

**Goal:** the things people come back a second time for: "what matters most this week", trials
they could join, and text a patient can actually read. Get the physician's written feedback
**in November**, not December.

Work, in this order:

- **Spec 007 `importance-rubric` (3 ev).** Includes a 20–30 item calibration set. **Send it to the
  Cure HHT contact** with the question "which of these would you flag as top-3 for your patients,
  and what's wrong in the summaries?" Their written answer satisfies criterion 3.
- **Spec 008 `clinical-trials` (5 ev).**
- **Spec 009 `patient-register` (4 ev).**
- Mid-quarter check (**2026-11-15**, 1 ev): count confirmed subscribers by `src`, email click-through
  per issue, and streak status.

**Done when:**

- Over 4 consecutive issues, at most 30% of items are "high or above", and each issue has a top-3.
- The recruiting-trials section is live, and a trial status change shows up in the next issue.
- Every item has patient text in ru + en with safety rules applied.
- **Written physician feedback received (criterion 3).**
- The 4-week streak is complete, or at least 2 weeks in with no manual runs (criterion 1).
- At least 25 confirmed subscribers by 2026-11-30 (midpoint for criterion 2).

**Kill/pivot rule:** if fewer than 10 confirmed subscribers by 2026-11-15 after posts in all 4
chats, **stop feature work**. Spend 3 evenings on 5 short conversations with patients from the
chats and re-plan December around what they say. That's the hypothesis failing, which is a
valid result.

**Depends on:** 004 (study type from H3), 005 (issue page to render trials and top-3), 006 (click
data for the check).

### Stage 3 — Storefront (2026-12-01 → 2026-12-24, about 7 evenings; 12-25 → 12-31 buffer and measurement)

**Goal:** a physician or Cure HHT staff member who lands on the site understands in 30 seconds
what it is, how it works, and why to trust it.

Work:

- **Spec 011 `public-trust` (4 ev)**, see §6.
- **Spec 010 `topic-tags` (3 ev), stretch.** It's the first thing cut if the buffer is gone.
- Cure HHT one-pager (en, not code): what it is, 3 screenshots, numbers from the quarter, ask.

**Done when:**

- The landing, methodology and about pages are live in ru + en, the README is rewritten
  product-first, and the one-pager has been sent.
- On 2026-12-31: the three criteria are evaluated in a short retro appended to this file.

**Depends on:** 005/006 (what the landing shows), 007 (the methodology describes the rubric).

---

## 6. Spec queue

Candidate changes and why:

- `002-operational-health` → **`004-pipeline-health`**. Renumbered because 002/003 exist. Widened to
  include watermark correctness, stale runs and cadence anchoring: "healthy" means runs are both
  observable and not losing data.
- `004-digest-summary` → merged into **`005-digest-issue`**. A summary is useless without a
  reader-visible issue to put it on, and 002 removed digests from the UI. The issue page is also
  the unit that is emailed and posted. It also absorbs the minimum of `005-patient-layer`
  (plain-language intro + one line per item + disclaimer + AI label) and metadata/OG, because
  Stage 1 can't ship without them.
- `005-patient-layer` → **`009-patient-register`**. The full per-item patient text comes after
  calibration, so the patient text isn't built on noisy importance.
- `006-subscriptions-newsletter` → **`006-email-subscriptions`**. Now also owns minimal analytics +
  `src` attribution, because criterion 2 must be provable from day one, not from December.
- `003-importance-calibration` → **`007-importance-rubric`**. Moved after the first reader: it
  doesn't block a first subscriber, and it doubles as the physician-feedback instrument.
- `009-public-trust` → **`011-public-trust`**. Domain and analytics moved out to Stage 1.
- Hotfixes H1–H4 are **not specs**. They are defects against existing 001 FRs, so fix them directly
  with tests (Constitution I applies to new capabilities).

| #   | Slug                  | Scope (one sentence)                                                                                                                                                                                                                                                                                                                                                        | Stage | Depends on    | Est. (ev) |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------- | --------- |
| 004 | `pipeline-health`     | Every source/run failure is logged at ERROR and alerts the owner within 1 h (GCP log-based alert + heartbeat URL for a dead-man switch). Failed sources keep their own watermark. Stale `running` runs are reaped, the manual-run stub is removed, and the weekly cadence is anchored. Public `/api/health` plus a visible "last checked / last issue" date.                | 0     | H1            | 3         |
| 005 | `digest-issue`        | The digest becomes a public, shareable weekly issue page (`/[locale]/projects/[slug]/issues/[id]`) with an AI-written "what changed and why it matters" intro in plain language (ru + en), one plain-language line per item, a medical disclaimer, an AI-generated label, localized header/metadata and OG image. It amends 002's "no digest grouping" decision and FR-017. | 1     | 004           | 4         |
| 006 | `email-subscriptions` | Email subscription for a project, ru/en: double opt-in, one-click unsubscribe (`List-Unsubscribe`), `src` attribution (vk/wa/fb/tg), the full issue sent as email via Resend on publish, click tracking, privacy note and data minimization. Includes cookie-less page analytics.                                                                                           | 1     | 005, domain   | 5         |
| 007 | `importance-rubric`   | Study-type rubric (from PubMed `PublicationType` + LLM fallback) sets the base level, and relative ranking within each issue picks the top-3. The summary is generated before the rating, and the prompt says "limited source text". A labeled calibration set is reviewed by the physician.                                                                                | 2     | H3, 005       | 3         |
| 008 | `clinical-trials`     | Trials become their own content type (phase, recruitment status, countries/sites, eligibility summary, NCT link, dates) with a "recruiting now" section and a status-change → re-surface in the next issue. Includes a patient-facing "how to ask about joining" (contact via site; no eligibility verdicts).                                                               | 2     | 004, 005      | 5         |
| 009 | `patient-register`    | Each item gets a patient layer (plain summary, "what this could mean", "what to ask your doctor") generated directly in ru + en under safety rules (no dosing or treatment advice, cite source, uncertainty wording). A patient/physician view switch.                                                                                                                      | 2     | 005, 007      | 4         |
| 010 | `topic-tags`          | A fixed project-scoped taxonomy (nose/epistaxis, lungs, liver, brain, GI, iron & anemia, pregnancy, children, genetics) assigned on ingest plus backfill, with filter chips on feed and issue. **Stretch; first to cut.**                                                                                                                                                   | 3     | 007           | 3         |
| 011 | `public-trust`        | Patient-first landing via single-project mode, methodology page (sources, cadence, how AI summarizes and ranks, limitations, who runs it, contact), about/Cure HHT context, README rewritten product-first, sitemap/robots.                                                                                                                                                 | 3     | 005, 006, 007 | 4         |

Hotfixes (no spec): H1 `monitoredSource` 400, 1 ev · H2 seed cleanup + guard, 0.5 ev · H3 PubMed/CT
dates + full abstracts + `PublicationType`, 1 ev · H4 watermark reset / catch-up, 0.5 ev.
Chores: domain + Resend verification + RF accessibility check, 1 ev · chat launch, 1 ev · mid-quarter
check, 1 ev.

**Total:** 31 (specs) + 3 (hotfixes) + 3 (chores) = **37 evenings**. Spec 010 (3 ev) is the release
valve.

---

## 7. Open questions for the owner

1. **Capacity.** Is 3–4 evenings/week realistic through December? At 2/week, Stage 1 lands in early
   November and spec 010 plus half of 009 drop out.
2. **Seed data.** OK to hard-delete `hht-research` and everything under it in production? Was the
   seed deliberately run against prod (for 003 verification), or by accident via `.env`?
3. **Domain.** Which name/TLD? Should it be neutral to the platform (topic-agnostic brand) or
   HHT-specific for patients? Which sender name for the newsletter?
4. **Russia accessibility and jurisdiction.** Where are you and the data legally based? Storing
   emails of Russian citizens (152-FZ), and "subscribed to an HHT newsletter" being health-adjacent
   data (GDPR Art. 9), affect where subscribers are stored and what consent text says. Is a simple
   explicit-consent checkbox plus a privacy page acceptable to you?
5. **What counts as a subscriber.** I recommend only email double opt-in counts toward the 50;
   Telegram channel followers don't, because they aren't attributable. Agree?
6. **Empty week.** If a week has 0 new relevant items, FR-010 means no issue. Does that week break
   the streak? I recommend it doesn't, as long as the run succeeded and `/api/health` shows it,
   because HHT output (~3–5 papers/week) makes this rare.
7. **Cure HHT contact.** Will they realistically label 20–30 items in November (spec 007)? If not,
   what's the smallest ask they'd answer in writing?
8. **Human in the loop.** Fully automatic sending, or a 12–24 h hold during which you can stop an
   issue? Criterion 1 is compatible with a hold only if it's opt-out (it sends unless you act).
9. **Patient text language.** Generate the patient layer directly in ru and en from the source
   (better quality), rather than English plus translation? That needs a Constitution VI / FR-017
   amendment.
10. **Reverse 002's decision** ("digests are not a visual grouping")? Spec 005 depends on it.
11. **Translations.** Amend FR-017 and Constitution III to match pre-generation, and stop
    pre-generating de/tr/uk for new patient-facing fields?
12. **Retention metric.** Add a leading indicator for "comes back": ≥30% of confirmed subscribers
    click in ≥2 different issues by Dec 31. Tracked, not a pass/fail gate. Agree?
13. **Weekday.** Which day/time (your timezone vs. readers') should the weekly issue go out?
