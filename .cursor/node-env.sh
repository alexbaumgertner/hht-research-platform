#!/usr/bin/env bash
# Activate Node.js 24 for Cloud Agent scripts.
#
# The repo requires Node >=24 (package.json "engines"), but the base VM image's
# default `node` can be older. nvm has Node 24 installed in the environment
# snapshot; this prepends its bin dir so `node`/`pnpm` resolve to 24 regardless
# of what precedes it on PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! nvm use 24 >/dev/null 2>&1; then
  nvm install 24 >/dev/null 2>&1 || true
  nvm use 24 >/dev/null 2>&1 || true
fi

NODE24_BIN="$(nvm which 24 2>/dev/null | xargs dirname 2>/dev/null || true)"
if [ -n "$NODE24_BIN" ]; then
  export PATH="$NODE24_BIN:$PATH"
fi

corepack enable >/dev/null 2>&1 || true
