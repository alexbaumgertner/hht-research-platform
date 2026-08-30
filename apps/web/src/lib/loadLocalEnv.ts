import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load apps/web `.env*` files into `process.env` for plain `tsx` scripts.
 * Next.js does this automatically for `next dev` / `next build`; tsx does not.
 * Existing process.env keys win (are not overwritten).
 */
export function loadLocalEnv(fromDir?: string): void {
  const webRoot = fromDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  for (const name of ['.env.development.local', '.env.local', '.env.development', '.env']) {
    loadEnvFile(path.join(webRoot, name));
  }
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
