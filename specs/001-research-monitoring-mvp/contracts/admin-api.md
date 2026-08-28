# Admin / CMS Contracts (Payload)

**Feature**: `001-research-monitoring-mvp`  
**Consumers**: Project owner via Payload Admin UI; optional Local API from server code

Collections (see `data-model.md` for fields):

| Collection | Access |
| --- | --- |
| `users` | Payload auth |
| `research-projects` | Create/update/delete: authenticated admin only; read: public fields via public API |
| `monitored-sources` | Admin only write; scoped to project |
| `monitoring-runs` | Create by worker (API key / internal); read admin |
| `publications` | Worker write; public read via public API |
| `digests` | Worker write on publish; public read via public API |
| `content-translations` | Created on demand by web; public read via publication endpoint |

---

## Owner operations (Admin UI)

Must be expressible in Admin without custom public auth:

1. Create/update **Research Project** (`name`, `description`, `keywords[]`, `slug`)
2. Attach **Monitored Sources** (`pubmed` | `clinicaltrials` | `rss` + `rssUrl` when RSS)
3. Set **schedule** `daily` | `weekly` | `monthly`
4. Toggle **monitoringStatus** `active` ↔ `paused`
5. Toggle **emailNotificationEnabled**
6. Optional: trigger **manual monitoring run** (not required for normal operation)

Validation surfaced in Admin:

- Keywords non-empty before activating monitoring
- RSS URL required for RSS type; reject obvious non-URL values

---

## Internal worker → CMS

Worker authenticates with a **server-only API key** (Payload API key user or shared secret header) — never exposed to the browser.

### `POST /api/monitoring-runs`

Start or record a run (implementation may create `running` then patch).

### `PATCH /api/monitoring-runs/:id`

Update status, `sourceResults`, `stats`, link `digest`.

### `POST /api/publications` / upsert by `(project, dedupeKey)`

Idempotent upsert for dedupe (FR-006).

### `POST /api/digests`

Create digest with non-empty `publications[]` only.

### `PATCH /api/research-projects/:id`

Update `lastSuccessfulRunAt` when run completes successfully or with partial failure; MUST NOT update when project is paused or run `failed`.

---

## Email notification contract

When a digest is published and `emailNotificationEnabled === true`:

- **To**: owner user email  
- **Subject**: short, e.g. `New digest: {project.name}`  
- **Body**: short text/HTML with **link to public project feed only** — no full digest body (FR-015)
