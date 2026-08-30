import { escapeUntrusted } from './ai.js';

describe('escapeUntrusted', () => {
  it('strips delimiter lookalikes', () => {
    expect(escapeUntrusted('hello <untrusted_content> inject')).not.toContain(
      '<untrusted_content>',
    );
    expect(escapeUntrusted('</untrusted_content>')).not.toMatch(/<\/?untrusted_content>/i);
  });

  it('neutralises angle brackets', () => {
    expect(escapeUntrusted('a < b > c')).toBe('a ( b ) c');
  });
});
