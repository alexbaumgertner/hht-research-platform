/**
 * Type-check in CI-parity mode.
 *
 * `scripts/ensure-schema.mjs` deletes the generated `src/payload-types.ts`
 * before `next build`, so the production build type-checks WITHOUT Payload's
 * generated types — `payload.find()` results are loosely typed there. This
 * wrapper reproduces that: it moves `payload-types.ts` aside, runs
 * `tsc --noEmit`, and always restores the file, so local `pnpm typecheck`
 * catches the same errors CI does.
 *
 * The stashed file is regenerable at any time with `pnpm generate:types`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typesFile = path.join(webDir, 'src', 'payload-types.ts');
const stash = `${typesFile}.ci-parity-bak`;

let stashed = false;

function restore() {
  if (stashed && existsSync(stash)) {
    renameSync(stash, typesFile);
    stashed = false;
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
}

// Recover a stash left behind by a previously killed run.
if (existsSync(stash) && !existsSync(typesFile)) {
  renameSync(stash, typesFile);
}

try {
  if (existsSync(typesFile)) {
    renameSync(typesFile, stash);
    stashed = true;
  }

  const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit'], {
    stdio: 'inherit',
    cwd: webDir,
  });
  process.exitCode = result.status ?? 1;
} finally {
  restore();
}
