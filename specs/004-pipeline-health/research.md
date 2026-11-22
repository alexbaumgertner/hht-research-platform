# Research: Pipeline Health (R1, R2)

## R1: ordering and paging of the two sources

**PubMed ESearch** (`datetype=edat`, `mindate`/`maxdate`, day precision). `sort` accepts
`relevance`, `pub_date`, `Author`, `JournalName` (and `most_recent`); none is "oldest EDAT first",
and `retmax` returns whatever the chosen order yields. The default order is not a stable date order.
Result: the cursor must not depend on ESearch order. The adapter lists all ids of the window
(`retmax` up to 10 000, ids only, cheap), drops ids already handled on the boundary day, fetches the
rest with EFetch in chunks of 200 and orders them itself by the `entrez` history date, which is the
EDAT day. Paging past `retmax` is not needed; a window above 10 000 ids is a keyword problem.

**ClinicalTrials.gov v2** (`/api/v2/studies`). Supports `sort=LastUpdatePostDate:asc`,
`pageSize` up to 1000 and `pageToken`. The range filter is
`AREA[LastUpdatePostDate]RANGE[YYYY-MM-DD,MAX]` at day precision, so several studies share a day.
Result: request ascending order with `pageSize = limit + excluded ids` (the excluded ones are on the
boundary day, i.e. at the start of the ascending order), re-order locally anyway, and use the
last-update day as the cursor key. Tie order within a day is unspecified, hence the per-source
`cursorState.processedIds` instead of an offset.

**RSS.** Feeds are newest first with optional dates. The whole matching feed is returned, ordered by
item timestamp (the cursor key); items without a date have no key and never move the watermark
backwards.

## R2: reaper vs long catch-up

The stale-run reaper marks `running` runs older than 2 h as failed. A run is bounded by
`BATCH_SIZE_PER_SOURCE` candidates per source (this spec does not add loops) and the Cloud Run task
timeout is 30 min, so a catch-up run cannot outlive the reaper. No change.
