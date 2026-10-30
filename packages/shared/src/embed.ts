import { z } from 'zod';

export const PartnerKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,31}$/);

/**
 * Exact origin `scheme://host[:port]`, lowercased. `https:` only, except `http:` for
 * localhost, 127.0.0.1 and `*.test`. Returns null for anything else (path, wildcard, userinfo...).
 */
export function normalizeEmbedOrigin(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.includes('*')) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?$/i.test(raw)) return null;
  const host = url.hostname;
  if (url.protocol === 'http:') {
    const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test');
    if (!local) return null;
  } else if (url.protocol !== 'https:') {
    return null;
  }
  return url.origin;
}

export type EmbedTheme = 'auto' | 'light' | 'dark';
export type EmbedMode = 'form' | 'link';
export type EmbedOptions = { theme: EmbedTheme; items: number; mode: EmbedMode };

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = { theme: 'auto', items: 3, mode: 'form' };

const OPTIONS_RE = /^(auto|light|dark)-([1-9]|1[0-9]|20)-(form|link)$/;

export function formatEmbedOptions(o: EmbedOptions): string {
  return `${o.theme}-${o.items}-${o.mode}`;
}

export function parseEmbedOptions(segment: string): {
  options: EmbedOptions;
  canonical: string;
  changed: boolean;
} {
  const m = OPTIONS_RE.exec(segment);
  const options: EmbedOptions = m
    ? { theme: m[1] as EmbedTheme, items: Number(m[2]), mode: m[3] as EmbedMode }
    : { ...DEFAULT_EMBED_OPTIONS };
  const canonical = formatEmbedOptions(options);
  return { options, canonical, changed: canonical !== segment };
}

export const EMBED_NOTICES = ['check_inbox', 'need_consent', 'bad_email', 'try_later'] as const;
export type EmbedNotice = (typeof EMBED_NOTICES)[number];

export function noticeToSegment(n: EmbedNotice): string {
  return n.replace('_', '-');
}

export function segmentToNotice(segment: string): EmbedNotice | null {
  const n = segment.replace('-', '_');
  return (EMBED_NOTICES as readonly string[]).includes(n) ? (n as EmbedNotice) : null;
}
