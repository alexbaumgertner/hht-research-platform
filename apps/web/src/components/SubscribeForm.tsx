import { cookies } from 'next/headers';
import { parseChatSource } from '@hht/shared';
import { getTranslations } from 'next-intl/server';

type Props = {
  projectName: string;
  projectSlug: string;
  locale: string;
  notice?: string | null;
  issueId?: string;
};

const NOTICES = new Set(['need_consent', 'bad_email', 'try_later', 'check_inbox']);

export async function SubscribeForm({ projectName, projectSlug, locale, notice, issueId }: Props) {
  const t = await getTranslations('Subscribe');
  const jar = await cookies();
  const src = parseChatSource(jar.get('src')?.value);
  const preset = locale === 'ru' ? 'ru' : 'en';
  const message =
    notice && NOTICES.has(notice)
      ? t(notice as 'need_consent' | 'bad_email' | 'try_later' | 'check_inbox')
      : null;

  return (
    <section id="subscribe">
      {message ? <p role="status">{message}</p> : null}
      <form method="post" action={`/api/public/projects/${projectSlug}/subscribe`}>
        <p>
          <label htmlFor="subscribe-email">{t('emailLabel')}</label>
          <input id="subscribe-email" name="email" type="email" required autoComplete="email" />
        </p>
        <fieldset>
          <legend>{t('languageLabel')}</legend>
          <label>
            <input type="radio" name="language" value="ru" defaultChecked={preset === 'ru'} />
            {t('languageRu')}
          </label>
          <label>
            <input type="radio" name="language" value="en" defaultChecked={preset === 'en'} />
            {t('languageEn')}
          </label>
        </fieldset>
        <p>
          <label>
            <input type="checkbox" name="consent" value="yes" /> {t('consentBefore')} {projectName}.{' '}
            <a href={`/${locale}/privacy`}>{t('privacyLink')}</a>
            {t('consentAfter')}
          </label>
        </p>
        <input type="hidden" name="src" value={src === 'other' ? '' : src} />
        {issueId ? <input type="hidden" name="issue" value={issueId} /> : null}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-10000px', height: 0, overflow: 'hidden' }}
        >
          <label htmlFor="subscribe-company">{t('honeypot')}</label>
          <input
            id="subscribe-company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <button type="submit">{t('submit')}</button>
      </form>
    </section>
  );
}
