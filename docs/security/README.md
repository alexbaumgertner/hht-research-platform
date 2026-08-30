# Security reviews

Point-in-time security reviews of the platform, one file per review, named
`YYYY-MM-DD-<short-sha>.md` after the commit that was reviewed.

## How this works

- **One file per review.** Pin the exact commit in the file header so findings can be checked
  against that revision. Don't edit an old review's findings — supersede them in a newer review.
- **The ledger below is the source of truth for current exposure.** Update a finding's status
  here when it's fixed or accepted; don't rewrite the original report.
- **Reference findings from fix commits**, e.g. `Fixes docs/security/2026-08-29-d8a6838.md#f1`,
  so history links the fix back to the report.
- **Unfixed vulnerabilities:** if this repo or its wiki is public, track remediation of open
  high/medium findings in a private GitHub Security Advisory or private issue rather than
  spelling out exploit detail in a committed file. Move the full write-up here once fixed.

## Reviews

| Date       | Commit    | Scope                     | Findings                     | Report                                         |
| ---------- | --------- | ------------------------- | ---------------------------- | ---------------------------------------------- |
| 2026-08-29 | `d8a6838` | `apps/web`, `apps/worker` | 2 high · 3 med · 6 hardening | [2026-08-29-d8a6838.md](2026-08-29-d8a6838.md) |

## Open findings

| #   | Finding                  | Severity | First reported         | Status | Notes                                                                                   |
| --- | ------------------------ | -------- | ---------------------- | ------ | --------------------------------------------------------------------------------------- |
| F3  | Public API rate limiting | Medium   | 2026-08-29 (`d8a6838`) | open   | AI write amplification fixed in code; rate limiting deferred to Vercel Firewall / BotID |

## Resolved findings

| #   | Finding                                              | Severity | First reported         | Resolved | Notes                                                                   |
| --- | ---------------------------------------------------- | -------- | ---------------------- | -------- | ----------------------------------------------------------------------- |
| F1  | Hardcoded fallback for `PAYLOAD_SECRET`              | High     | 2026-08-29 (`d8a6838`) | fixed    | `requiredEnv()`; build-time schema push uses `randomUUID()`             |
| F2  | SSRF via `MonitoredSources.rssUrl`                   | High     | 2026-08-29 (`d8a6838`) | fixed    | `safeFetch` with connect-time IP block, redirect re-check, size/timeout |
| F3a | Unauthenticated AI cost & write amplification        | Medium   | 2026-08-29 (`d8a6838`) | fixed    | Public GET is read-only; worker pre-generates translations              |
| F4  | Stored XSS via `originalUrl` rendered as `href`      | Medium   | 2026-08-29 (`d8a6838`) | fixed    | `sanitizeHttpUrl` at ingest, storage, projection, and render            |
| F5  | Public read broader than the curated API implies     | Medium   | 2026-08-29 (`d8a6838`) | fixed    | Collection read → `isAuthenticatedOrWorker`; GraphQL disabled           |
| H1  | Prompt injection from external content               | Low      | 2026-08-29 (`d8a6838`) | fixed    | Delimited untrusted content + system instructions                       |
| H2  | No ownership check on `manualRun`                    | Low      | 2026-08-29 (`d8a6838`) | fixed    | Admin or project owner only                                             |
| H3  | `assertLinkOnlyEmail` is never called                | Low      | 2026-08-29 (`d8a6838`) | fixed    | Enforced in `sendDigestPublishedEmail` before Resend                    |
| H4  | Shared static bearer secret (`X-Payload-API-Key`)    | Low      | 2026-08-29 (`d8a6838`) | fixed    | `timingSafeEqual`; native per-user API keys remain a follow-up          |
| H5  | User enumeration by `worker`-role accounts           | Low      | 2026-08-29 (`d8a6838`) | fixed    | `Users.read` admin-or-self                                              |
| H6  | Over-permissive field access on `hasPublishedDigest` | Low      | 2026-08-29 (`d8a6838`) | fixed    | Field update → `isWorkerOrAdminFieldLevel`                              |
