import { buildEmbedHeaders } from './embedHeaders';

describe('buildEmbedHeaders', () => {
  it('limits framing to the partner origins', () => {
    const h = buildEmbedHeaders({ origins: ['https://a.example', 'http://partner.test'] });
    expect(h['Content-Security-Policy']).toBe(
      'frame-ancestors https://a.example http://partner.test',
    );
  });

  it("uses 'none' without origins", () => {
    expect(buildEmbedHeaders({ origins: [] })['Content-Security-Policy']).toBe(
      "frame-ancestors 'none'",
    );
    expect(buildEmbedHeaders({})['Content-Security-Policy']).toBe("frame-ancestors 'none'");
  });

  it('always sets the fixed headers and never framing or cookie headers', () => {
    const h = buildEmbedHeaders({ origins: ['https://a.example'] });
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Content-Type']).toBe('text/html; charset=utf-8');
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain('x-frame-options');
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain('set-cookie');
  });
});
