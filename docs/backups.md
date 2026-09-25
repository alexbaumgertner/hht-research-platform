# Database backups

A Vercel Cron job (`apps/web/vercel.json`, daily at 03:00 UTC) calls `GET /api/cron/backup`. It
reads every table in one consistent snapshot, gzips it, encrypts it with AES-256-GCM and emails the
file to `BACKUP_EMAIL` as `hht-news-YYYY-MM-DD.json.gz.enc`. The mailbox is the only copy store.

If a backup fails, the route emails "HHT News backup NOT made" with the error. No email at all on a
given day means the cron did not run; check Vercel → Project → Cron Jobs.

Neon's free-tier point-in-time restore covers hours. These copies cover a deletion noticed days later.

## What is in a copy

Data only, all tables except short-lived ones (`auth_codes`, `users_sessions`, Payload locks/kv and the
`payload_migrations` push marker). The schema is not in the copy: Payload recreates it from the code
(`ensure-schema`), so restore with the code at, or close to, the backup's date.

## Setup (Vercel → Settings → Environment Variables, **Production** only)

| Variable       | Value                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| `BACKUP_KEY`   | `openssl rand -base64 32`. **Store it in the password manager.** Losing it loses every copy. |
| `BACKUP_EMAIL` | Where copies go. With the Resend sandbox sender this must be the Resend account's email.     |
| `CRON_SECRET`  | Any long random string. Vercel sends it as `Authorization: Bearer …`.                        |

Without `CRON_SECRET` the route refuses every request on Vercel. Without `BACKUP_KEY` it refuses to
send an unencrypted copy and emails the failure instead.

Run one backup by hand after setting the variables:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://hhtnews.growtomiddle.dev/api/cron/backup
```

## Check a copy (every few months)

```bash
BACKUP_KEY='…' pnpm --filter @hht/web backup:verify -- ~/Downloads/hht-news-2026-09-25.json.gz.enc
```

It decrypts the file, prints row counts per table and fails if there are no projects or publications.
It touches no database.

## Restore

Restore goes into an **empty** database. The script refuses any table that already has rows, and runs
in one transaction, so a failure leaves the target untouched.

1. Create an empty database: locally `createdb`, or a new Neon branch/database for a real recovery.
2. Restore:

   ```bash
   DATABASE_URL=postgres://…/empty_db BACKUP_KEY='…' \
     pnpm --filter @hht/web backup:restore -- ~/Downloads/hht-news-2026-09-25.json.gz.enc
   ```

   Starting Payload pushes the schema, then rows are inserted and sequences reset. A remote database
   also needs `ALLOW_REMOTE_DATABASE=1`.

3. For production, point Vercel's `DATABASE_URL` at the restored database and redeploy.

Tested on 2026-09-25: restoring a copy of the local database gave identical content in all 19 tables.
