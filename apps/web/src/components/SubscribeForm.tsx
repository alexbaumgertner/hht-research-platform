import type { CSSProperties } from 'react';
import { cookies } from 'next/headers';
import { Box, Group, Stack, Text } from '@mantine/core';
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

const cardStyle: CSSProperties = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
  background: 'var(--mantine-color-gray-0)',
};

const emailInputStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.75rem',
  fontSize: 'var(--mantine-font-size-sm)',
  lineHeight: 1.5,
  border: '1px solid var(--mantine-color-gray-4)',
  borderRadius: 'var(--mantine-radius-sm)',
  backgroundColor: 'var(--mantine-color-body)',
  color: 'var(--mantine-color-text)',
};

const fieldsetStyle: CSSProperties = {
  border: 'none',
  margin: 0,
  padding: 0,
};

const choiceLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: 'var(--mantine-font-size-sm)',
  cursor: 'pointer',
};

const submitButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1rem',
  fontSize: 'var(--mantine-font-size-sm)',
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--mantine-color-white)',
  backgroundColor: 'var(--mantine-color-teal-6)',
  border: 'none',
  borderRadius: 'var(--mantine-radius-sm)',
  cursor: 'pointer',
  width: 'fit-content',
};

export async function SubscribeForm({ projectName, projectSlug, locale, notice, issueId }: Props) {
  const t = await getTranslations('Subscribe');
  const jar = await cookies();
  const src = parseChatSource(jar.get('src')?.value);
  const preset = locale === 'ru' ? 'ru' : 'en';
  const message =
    notice && NOTICES.has(notice)
      ? t(notice as 'need_consent' | 'bad_email' | 'try_later' | 'check_inbox')
      : null;
  const isSuccess = notice === 'check_inbox';

  return (
    <Box component="section" id="subscribe" p="md" style={cardStyle}>
      <Stack gap="sm">
        {message ? (
          <Text
            component="p"
            role="status"
            size="sm"
            fw={500}
            c={isSuccess ? 'teal.8' : 'red.7'}
            m={0}
          >
            {message}
          </Text>
        ) : null}
        <form method="post" action={`/api/public/projects/${projectSlug}/subscribe`}>
          <Stack gap="sm">
            <Stack gap={4}>
              <Text component="label" htmlFor="subscribe-email" size="sm" fw={500}>
                {t('emailLabel')}
              </Text>
              <input
                id="subscribe-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                style={emailInputStyle}
              />
            </Stack>
            <fieldset style={fieldsetStyle}>
              <Text component="legend" size="sm" fw={500} mb={4}>
                {t('languageLabel')}
              </Text>
              <Group gap="md" wrap="wrap">
                <label style={choiceLabelStyle}>
                  <input type="radio" name="language" value="ru" defaultChecked={preset === 'ru'} />
                  {t('languageRu')}
                </label>
                <label style={choiceLabelStyle}>
                  <input type="radio" name="language" value="en" defaultChecked={preset === 'en'} />
                  {t('languageEn')}
                </label>
              </Group>
            </fieldset>
            <Text component="p" size="sm" m={0} style={{ overflowWrap: 'anywhere' }}>
              <label style={{ ...choiceLabelStyle, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  name="consent"
                  value="yes"
                  style={{ marginTop: '0.2rem', flexShrink: 0 }}
                />
                <span>
                  {t('consentBefore')} {projectName}.{' '}
                  <a href={`/${locale}/privacy`} style={{ color: 'var(--mantine-color-teal-7)' }}>
                    {t('privacyLink')}
                  </a>
                  {t('consentAfter')}
                </span>
              </label>
            </Text>
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
            <button type="submit" style={submitButtonStyle}>
              {t('submit')}
            </button>
          </Stack>
        </form>
      </Stack>
    </Box>
  );
}
