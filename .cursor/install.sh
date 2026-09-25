#!/usr/bin/env bash
# Cloud Agent install phase: runs after checkout. Idempotent; must terminate.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source .cursor/node-env.sh
echo "Using node $(node -v), pnpm $(pnpm -v)"

# Install workspace dependencies.
pnpm install --frozen-lockfile

# Local env for apps/web. Gitignored, so it must be recreated on a fresh
# checkout. Points at the local Postgres this VM runs (see docker-compose.yml
# for the equivalent service). Never leave DATABASE_URL pointed at a managed DB.
ENV_FILE="apps/web/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
DATABASE_URL=postgres://payload:payload@localhost:5432/payload
PAYLOAD_SECRET=local-dev-payload-secret-please-change-0123456789abcdef
PAYLOAD_API_KEY=local-dev-worker-api-key
PUBLIC_SITE_URL=http://localhost:3000
AI_GATEWAY_API_KEY=
AI_GATEWAY_MODEL=openai/gpt-4o-mini
RESEND_API_KEY=
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

echo "install.sh complete"
