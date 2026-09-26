#!/usr/bin/env bash
# Cloud Agent start phase: runs on every boot. Idempotent; must return.
# Brings up the local Postgres and ensures the Payload schema exists so the
# web app and its API work immediately.
set -euo pipefail

cd "$(dirname "$0")/.."

# Start the native Postgres 16 cluster (stands in for `docker compose up`).
PGDATA_PID="/var/lib/postgresql/16/main/postmaster.pid"
if ! pg_isready -h localhost -U payload >/dev/null 2>&1; then
  # A disk snapshot captures files but not the running process, so a stale
  # postmaster.pid can be left behind. Remove it ONLY when the cluster is really
  # down and the pid it references is not a live process — never while Postgres
  # is mid-startup.
  if ! sudo pg_ctlcluster 16 main status >/dev/null 2>&1; then
    stale_pid="$(sudo head -n1 "$PGDATA_PID" 2>/dev/null || true)"
    if [ -z "$stale_pid" ] || ! sudo kill -0 "$stale_pid" 2>/dev/null; then
      sudo rm -f "$PGDATA_PID" 2>/dev/null || true
    fi
  fi
  sudo pg_ctlcluster 16 main start 2>/dev/null \
    || sudo pg_ctlcluster 16 main restart 2>/dev/null \
    || echo "WARN start.sh: could not start the Postgres 16 cluster" >&2
fi

# Wait for readiness.
pg_ready=0
for _ in $(seq 1 30); do
  if pg_isready -h localhost -U payload >/dev/null 2>&1; then
    pg_ready=1
    break
  fi
  sleep 1
done
if [ "$pg_ready" -ne 1 ]; then
  echo "WARN start.sh: Postgres did not become ready in time" >&2
fi

# Ensure role + database exist (idempotent; snapshot normally already has them).
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='payload'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE payload WITH LOGIN PASSWORD 'payload' SUPERUSER;"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='payload'" | grep -q 1; then
  sudo -u postgres createdb -O payload payload
fi

# Push the Payload schema so API routes return data instead of 500s. Idempotent.
# shellcheck disable=SC1091
source .cursor/node-env.sh
pnpm --filter @hht/web ensure-schema \
  || echo "WARN start.sh: ensure-schema failed — API routes may return 500" >&2

echo "start.sh complete"
