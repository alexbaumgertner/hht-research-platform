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

| #   | Finding                                              | Severity | First reported         | Status |
| --- | ---------------------------------------------------- | -------- | ---------------------- | ------ |
| F1  | Hardcoded fallback for `PAYLOAD_SECRET`              | High     | 2026-08-29 (`d8a6838`) | open   |
| F2  | SSRF via `MonitoredSources.rssUrl`                   | High     | 2026-08-29 (`d8a6838`) | open   |
| F3  | Unauthenticated AI cost & write amplification        | Medium   | 2026-08-29 (`d8a6838`) | open   |
| F4  | Stored XSS via `originalUrl` rendered as `href`      | Medium   | 2026-08-29 (`d8a6838`) | open   |
| F5  | Public read broader than the curated API implies     | Medium   | 2026-08-29 (`d8a6838`) | open   |
| H1  | Prompt injection from external content               | Low      | 2026-08-29 (`d8a6838`) | open   |
| H2  | No ownership check on `manualRun`                    | Low      | 2026-08-29 (`d8a6838`) | open   |
| H3  | `assertLinkOnlyEmail` is never called                | Low      | 2026-08-29 (`d8a6838`) | open   |
| H4  | Shared static bearer secret (`X-Payload-API-Key`)    | Low      | 2026-08-29 (`d8a6838`) | open   |
| H5  | User enumeration by `worker`-role accounts           | Low      | 2026-08-29 (`d8a6838`) | open   |
| H6  | Over-permissive field access on `hasPublishedDigest` | Low      | 2026-08-29 (`d8a6838`) | open   |

## Resolved findings

_None yet._
