import { buildSummarizePrompt, escapeUntrusted } from './ai.js';

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

describe('buildSummarizePrompt', () => {
  it('uses plain patient-facing instructions and safety rules instead of specialist jargon', () => {
    const { system, prompt } = buildSummarizePrompt({
      title: 'Bevacizumab in HHT',
      abstractOrBody: 'A study of nosebleeds.',
      keywords: ['HHT', 'epistaxis'],
      sourceType: 'pubmed',
      publicationTypes: ['Case Reports'],
    });
    expect(system).toMatch(/patients and families/i);
    expect(system).toMatch(/plain everyday English/i);
    expect(system).toMatch(/never include a dose/i);
    expect(system).not.toMatch(/for specialists monitoring/i);
    expect(prompt).toContain('Study types: Case Reports');
    expect(prompt).toContain('<untrusted_content>');
  });

  it('marks clinical trial registrations as having no results yet', () => {
    const { prompt } = buildSummarizePrompt({
      title: 'Phase II trial in HHT',
      keywords: ['HHT'],
      sourceType: 'clinicaltrials',
    });
    expect(prompt).toMatch(/clinical trial registration.*no results yet/i);
  });
});
