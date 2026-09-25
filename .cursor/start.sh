#!/usr/bin/env bash
# Cloud Agent start phase: runs on every boot. Idempotent; must return.
# Brings up the local Postgres and ensures the Payload schema exists so the
# web app and its API work immediately.
set -euo pipefail

cd "$(dirname "$0")/.."

# Start the native Postgres 16 cluster (stands in for `docker compose up`).
sudo pg_ctlcluster 16 main start 2>/dev/null || true

# Wait for readiness.
for _ in $(seq 1 30); do
  if pg_isready -h localhost -U payload >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

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
pnpm --filter @hht/web ensure-schema || true

echo "start.sh complete"
