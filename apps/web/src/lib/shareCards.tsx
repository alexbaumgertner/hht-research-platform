import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@hht/shared';

import { formatIssueDate } from '@/lib/issues';
import { SHARE_IMAGE_SIZE } from '@/lib/metadata';

const FONT_FAMILY = 'IBM Plex Sans';
const fontsDir = join(process.cwd(), 'assets/fonts');

let fontsPromise: Promise<[Buffer, Buffer]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(fontsDir, 'IBMPlexSans-Regular.ttf')),
    readFile(join(fontsDir, 'IBMPlexSans-SemiBold.ttf')),
  ]);
  return fontsPromise;
}

type ShareCardContent = {
  eyebrow?: string;
  title: string;
  lines: string[];
};

async function renderShareCard({ eyebrow, title, lines }: ShareCardContent) {
  const [regular, semiBold] = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: 'linear-gradient(135deg, #0b7285 0%, #087f5b 100%)',
        color: '#ffffff',
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, opacity: 0.85 }}>{eyebrow ?? ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 600, lineHeight: 1.1 }}>
          {title}
        </div>
        {lines.map((line) => (
          <div key={line} style={{ display: 'flex', fontSize: 40, lineHeight: 1.3 }}>
            {line}
          </div>
        ))}
      </div>
    </div>,
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { name: FONT_FAMILY, data: regular, weight: 400, style: 'normal' },
        { name: FONT_FAMILY, data: semiBold, weight: 600, style: 'normal' },
      ],
    },
  );
}

export async function renderSiteCard(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Site' });
  return renderShareCard({ title: t('name'), lines: [t('tagline')] });
}

export async function renderProjectCard(locale: Locale, projectName: string) {
  const [tSite, tProject] = await Promise.all([
    getTranslations({ locale, namespace: 'Site' }),
    getTranslations({ locale, namespace: 'Project' }),
  ]);
  return renderShareCard({
    eyebrow: tSite('name'),
    title: projectName,
    lines: [tProject('imageTagline')],
  });
}

export async function renderIssueCard(
  locale: Locale,
  issue: { projectName: string; date: string; itemCount: number },
) {
  const [tSite, tIssue] = await Promise.all([
    getTranslations({ locale, namespace: 'Site' }),
    getTranslations({ locale, namespace: 'Issue' }),
  ]);
  return renderShareCard({
    eyebrow: tSite('name'),
    title: issue.projectName,
    lines: [formatIssueDate(issue.date, locale), tIssue('imageCount', { count: issue.itemCount })],
  });
}
