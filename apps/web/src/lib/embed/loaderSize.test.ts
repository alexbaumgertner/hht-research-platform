import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const file = path.join(process.cwd(), 'public/embed/v1.js');

describe('embed loader v1.js', () => {
  const source = fs.readFileSync(file, 'utf8');

  it('stays within 3 KB gzipped (FR-025)', () => {
    expect(zlib.gzipSync(source, { level: 9 }).length).toBeLessThanOrEqual(3072);
  });

  it.each([
    /\bimport\b/,
    /\brequire\s*\(/,
    /\beval\s*\(/,
    /document\.cookie/,
    /localStorage/,
    /sessionStorage/,
  ])('does not use %s', (pattern) => {
    expect(source).not.toMatch(pattern);
  });
});
