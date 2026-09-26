#!/usr/bin/env bash
# Cloud Agent install phase: runs after checkout. Idempotent; must terminate.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source .cursor/node-env.sh
echo "Using node $(node -v), pnpm $(pnpm -v)"

# Provision PostgreSQL 16 when the base image doesn't already ship it. A
# committed .cursor/environment.json takes precedence over any snapshot-based
# dashboard environment, so this install must be self-sufficient on the default
# base image. Runs at Build time and is captured in the resulting snapshot.
# Check for version 16 specifically: another Postgres major must not satisfy it.
if ! { pg_lsclusters 2>/dev/null | grep -q '^16 '; } \
  && [ ! -x /usr/lib/postgresql/16/bin/postgres ]; then
  echo "Installing PostgreSQL 16..."
  # Add the official PGDG apt repository when postgresql-16 isn't a candidate in
  # the default repos (e.g. Ubuntu 22.04 ships Postgres 14).
  if ! apt-cache policy postgresql-16 2>/dev/null | grep -qE 'Candidate: [0-9]'; then
    echo "postgresql-16 not in default apt repos; adding the PGDG repository..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates gnupg lsb-release
    sudo install -d /usr/share/postgresql-common/pgdg
    sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  fi
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-16 postgresql-client-16
fi

# Install workspace dependencies.
pnpm install --frozen-lockfile

# Local env for apps/web. Gitignored, so it must be recreated on a fresh
# checkout. Points at the local Postgres this VM runs (see docker-compose.yml
# for the equivalent service). Never leave DATABASE_URL pointed at a managed DB.
ENV_FILE="apps/web/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  # Note: AI_GATEWAY_API_KEY and RESEND_API_KEY are intentionally omitted. They
  # are injected from Cursor Secrets as process env vars; writing empty values
  # here could shadow the real secrets for any tool that loads .env with
  # override. The app/worker degrade gracefully when these are unset.
  cat > "$ENV_FILE" <<'EOF'
DATABASE_URL=postgres://payload:payload@localhost:5432/payload
PAYLOAD_SECRET=local-dev-payload-secret-please-change-0123456789abcdef
PAYLOAD_API_KEY=local-dev-worker-api-key
PUBLIC_SITE_URL=http://localhost:3000
AI_GATEWAY_MODEL=openai/gpt-4o-mini
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=Research Monitoring
BOOTSTRAP_LOOKBACK_DAYS=30
BATCH_SIZE_PER_SOURCE=50
SEED_OWNER_EMAIL=owner@example.com
SEED_OWNER_PASSWORD=ChangeMe123!
PLAYWRIGHT_BASE_URL=http://localhost:3000
EOF
  echo "Wrote $ENV_FILE"
fi

# apps/worker's tsconfig references the built @hht/shared, and web/worker
# typecheck + tests need its .d.ts, so build it during install.
pnpm --filter @hht/shared build

# Playwright browser for `pnpm test:e2e`. Idempotent (skips already-installed
# browsers); baked into the Build so e2e works without a per-boot download.
pnpm --filter @hht/web exec playwright install --with-deps chromium

echo "install.sh complete"
