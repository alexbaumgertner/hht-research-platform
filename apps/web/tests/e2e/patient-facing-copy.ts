import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATIENT_COPY_LOCALES = ['en', 'de', 'tr', 'ru', 'uk'] as const;
export type PatientCopyLocale = (typeof PATIENT_COPY_LOCALES)[number];

const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../messages');

/** Internal terminology that must not appear in patient-facing chrome (FR-018). */
export const BANNED_CHROME_PATTERNS: RegExp[] = [
  /research\s+monitoring/i,
  /monitoring/i,
  /digest/i,
  /configured/i,
  /publication/i,
  /дайджест/i,
  /мониторинг/i,
  /моніторинг/i,
  /konfiguriert/i,
  /yapılandırılmış/i,
  /настроенн/i,
  /налаштован/i,
  /\bizleme\b/i,
];

export const CHROME_MESSAGE_KEYS: Array<{ namespace: string; keys: string[] }> = [
  { namespace: 'Site', keys: ['name', 'description', 'tagline'] },
  { namespace: 'Home', keys: ['title', 'subtitle', 'metaTitle', 'latestDigest'] },
  { namespace: 'Project', keys: ['metaDescription', 'imageTagline', 'imageAlt'] },
];

type Messages = Record<string, Record<string, string>>;

export function loadLocaleMessages(locale: PatientCopyLocale): Messages {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Messages;
}

export function collectChromeStrings(messages: Messages): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const { namespace, keys } of CHROME_MESSAGE_KEYS) {
    for (const key of keys) {
      const value = messages[namespace]?.[key];
      if (value) out.push({ key: `${namespace}.${key}`, value });
    }
  }
  return out;
}

export function findBannedChromeTerms(text: string): RegExp[] {
  return BANNED_CHROME_PATTERNS.filter((pattern) => pattern.test(text));
}

export const PATIENT_CHROME: Record<
  PatientCopyLocale,
  { siteName: string; homeTitle: string; homeSubtitle: string }
> = {
  en: {
    siteName: 'Research Updates',
    homeTitle: 'Research updates',
    homeSubtitle: 'Plain-language summaries of new medical research, with a link to every source.',
  },
  de: {
    siteName: 'Forschung verständlich',
    homeTitle: 'Forschungsupdates',
    homeSubtitle:
      'Leicht verständliche Zusammenfassungen neuer medizinischer Forschung – mit Link zu jeder Quelle.',
  },
  tr: {
    siteName: 'Araştırma Güncellemeleri',
    homeTitle: 'Araştırma güncellemeleri',
    homeSubtitle: 'Yeni tıbbi araştırmalar hakkında sade dilde özetler; her kaynağa bağlantıyla.',
  },
  ru: {
    siteName: 'Исследования понятно',
    homeTitle: 'Обновления исследований',
    homeSubtitle: 'Понятные обзоры новых медицинских исследований со ссылкой на каждый источник.',
  },
  uk: {
    siteName: 'Дослідження зрозуміло',
    homeTitle: 'Оновлення досліджень',
    homeSubtitle: 'Зрозумілі огляди нових медичних досліджень із посиланням на кожне джерело.',
  },
};
