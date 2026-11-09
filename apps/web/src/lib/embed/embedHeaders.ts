/** Headers for every `/embed/*` HTML response. No `X-Frame-Options`, no cookies (spec FR-009, FR-016). */
export function buildEmbedHeaders(input: { origins?: readonly string[] }): Record<string, string> {
  const origins = input.origins ?? [];
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `frame-ancestors ${origins.length > 0 ? origins.join(' ') : "'none'"}`,
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
