import { readFileSync } from 'node:fs';
import path from 'node:path';

// Spec 004 US3 / T011: the project page shows when sources were last checked, so a quiet week is
// distinguishable from a broken pipeline. The page renders `Project.lastChecked` with a {date} slot.
function projectMessages(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), 'messages', `${locale}.json`);
  return (JSON.parse(readFileSync(file, 'utf8')) as { Project: Record<string, string> }).Project;
}

describe('Project.lastChecked copy', () => {
  it('has the expected wording in en and ru', () => {
    expect(projectMessages('en').lastChecked).toBe('Sources last checked: {date}');
    expect(projectMessages('ru').lastChecked).toBe('Источники последний раз проверены: {date}');
  });

  it.each(['en', 'ru', 'de', 'tr', 'uk'])('is present with a {date} slot in %s', (locale) => {
    expect(projectMessages(locale).lastChecked).toContain('{date}');
  });
});
