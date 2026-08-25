import type { Summary } from '@hht/shared';

export function buildMachineTranslationFallbackUrl(text: string, targetLocale: string): string {
  const url = new URL('https://translate.google.com/');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', targetLocale);
  url.searchParams.set('text', text.slice(0, 4500));
  return url.toString();
}

export function summaryToPlainText(summary: Summary): string {
  return [
    summary.objective,
    summary.methods,
    summary.results,
    summary.limitations,
    summary.whyItMatters,
  ]
    .filter(Boolean)
    .join('\n\n');
}
