/**
 * Type-check against both shapes the production build can see.
 *
 * 1. WITHOUT Payload's generated types. `scripts/ensure-schema.mjs` deletes
 *    `src/payload-types.ts` before `next build`, so `payload.find()` results are
 *    loosely typed there.
 * 2. WITH freshly generated types. On Vercel the file is back by the time
 *    `next build` type-checks (Payload writes it after ensure-schema's delete),
 *    so code must also compile against the strict generated interfaces. Pass 1
 *    alone let a Vercel-only build failure through (2026-09-24).
 *
 * Generating types needs no database connection. The fresh file is left in
 * place (it is gitignored); any previous copy is restored if generation fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
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

function tsc(label) {
  console.log(`typecheck: ${label}`);
  const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit'], {
    stdio: 'inherit',
    cwd: webDir,
  });
  return result.status ?? 1;
}

try {
  if (existsSync(typesFile)) {
    renameSync(typesFile, stash);
    stashed = true;
  }

  const withoutTypes = tsc('without generated Payload types (ensure-schema build)');
  if (withoutTypes !== 0) {
    process.exitCode = withoutTypes;
  } else {
    const generated = spawnSync('pnpm', ['run', '--silent', 'generate:types'], {
      stdio: 'inherit',
      cwd: webDir,
      env: {
        ...process.env,
        // The config requires these, but type generation never connects.
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'typecheck',
        DATABASE_URL: process.env.DATABASE_URL || 'postgres://typecheck@127.0.0.1:1/typecheck',
      },
    });
    if (generated.status !== 0 || !existsSync(typesFile)) {
      console.error('typecheck: payload generate:types failed');
      process.exitCode = generated.status || 1;
    } else {
      // Fresh types supersede any stashed copy.
      if (stashed) rmSync(stash, { force: true });
      stashed = false;
      process.exitCode = tsc('with generated Payload types (Vercel build)');
    }
  }
} finally {
  restore();
}
