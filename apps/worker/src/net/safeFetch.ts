import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';
import { lookup as dnsLookup } from 'node:dns';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function allowPrivateNetwork(): boolean {
  return process.env.ALLOW_PRIVATE_NETWORK_FETCH === '1';
}

function hostAllowlist(): Set<string> | null {
  const raw = process.env.RSS_HOST_ALLOWLIST?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Pure: reject loopback, private, link-local, CGNAT, multicast, reserved, ULA. */
export function isBlockedAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');

  // IPv4-mapped IPv6 (:ffff:a.b.c.d)
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isBlockedAddress(v4Mapped[1]!);

  if (normalized.includes(':')) {
    if (normalized === '::1' || normalized === '::') return true;
    if (
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('ff')
    ) {
      return true;
    }
    return false;
  }

  const parts = normalized.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (parts[2] ?? 0) <= 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;

  return false;
}

export function assertAllowedUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked protocol: ${url.protocol}`);
  }

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new Error(`Blocked port: ${port}`);
  }

  const allowlist = hostAllowlist();
  if (allowlist && !allowlist.has(url.hostname.toLowerCase())) {
    throw new Error(`Host not in RSS_HOST_ALLOWLIST: ${url.hostname}`);
  }

  const host = url.hostname.toLowerCase();
  if (!allowPrivateNetwork()) {
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      throw new Error(`Blocked hostname: ${host}`);
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || (host.includes(':') && !host.includes('.'))) {
      if (isBlockedAddress(host)) {
        throw new Error(`Blocked address: ${host}`);
      }
    }
  }

  return url;
}

type LookupEntry = { address: string; family: number };

/**
 * DNS lookup that rejects private / loopback / link-local resolved addresses —
 * closes the DNS-rebinding hole that literal-IP checks miss.
 *
 * undici's connector calls this with `{ all: true }`, so the result is an array
 * and the callback must be `cb(err, LookupEntry[])`; Node's own callers may use
 * the single-address form `cb(err, address, family)`. Both shapes are handled.
 */
export function guardedLookup(hostname: string, options: unknown, callback?: unknown): void {
  const cb = (typeof options === 'function' ? options : callback) as (
    err: NodeJS.ErrnoException | null,
    address: string | LookupEntry[],
    family?: number,
  ) => void;
  const opts = (typeof options === 'function' ? {} : options) as {
    family?: number;
    hints?: number;
    all?: boolean;
    verbatim?: boolean;
  };

  dnsLookup(hostname, opts, (err, address, family) => {
    if (err) {
      cb(err, '', 0);
      return;
    }

    const entries: LookupEntry[] = Array.isArray(address)
      ? (address as LookupEntry[])
      : [{ address: String(address), family: family as number }];

    if (!allowPrivateNetwork()) {
      const blocked = entries.find((e) => isBlockedAddress(e.address));
      if (blocked) {
        cb(new Error(`Blocked resolved address for ${hostname}: ${blocked.address}`), '', 0);
        return;
      }
    }

    if (opts.all) {
      cb(null, entries);
    } else {
      cb(null, entries[0]!.address, entries[0]!.family);
    }
  });
}

const agent = new Agent({
  connect: {
    // undici Agent connect.lookup — block private IPs at connect time (DNS rebinding)
    lookup: guardedLookup as never,
  },
});

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
};

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

/**
 * SSRF-hardened fetch: http(s) only, connect-time IP block, manual redirect
 * re-validation, timeout, and response size cap.
 */
export async function safeFetch(
  inputUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let current = assertAllowedUrl(inputUrl).href;
  let redirects = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init: UndiciRequestInit = {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        dispatcher: agent,
        headers: options.headers,
      };
      const res = await undiciFetch(current, init);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect without Location: ${res.status}`);
        }
        redirects += 1;
        if (redirects > MAX_REDIRECTS) {
          throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
        }
        current = assertAllowedUrl(new URL(location, current).href).href;
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) {
        throw new Error(`Response exceeded ${maxBytes} bytes`);
      }
      const bodyText = buf.toString('utf8');

      const headers = new Headers();
      for (const [key, value] of res.headers.entries()) {
        headers.set(key, value);
      }

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        headers,
        text: async () => bodyText,
        json: async () => JSON.parse(bodyText) as unknown,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
