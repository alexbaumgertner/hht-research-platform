import type { EmbedOptions, Locale } from '@hht/shared';

import { formatIssueDate, type IssueDetail, type IssueDetailItem } from '@/lib/issues';

export type EmbedT = (key: string, values?: Record<string, string | number>) => string;

export type EmbedLinks = {
  issue: string;
  archive: string;
  subscribe: string;
  privacy: string;
  item: (publicationId: string) => string;
};

export type EmbedModel = {
  locale: Locale;
  options: EmbedOptions;
  project: { id: string | number; slug: string; name: string };
  partner: { key: string; name: string; origins: string[] };
  issue: IssueDetail | null;
  items: IssueDetailItem[];
  moreCount: number;
  /** Always null until spec 013 ships (research R13). */
  periodReview: { title: string; url: string } | null;
  source: string;
  links: EmbedLinks;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only absolute http(s) URLs survive; anything else becomes null. */
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function link(href: string, label: string, attrs = ''): string {
  const safe = safeUrl(href);
  if (!safe) return escapeHtml(label);
  return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener"${attrs}>${escapeHtml(label)}</a>`;
}

const CSS = `
:root{color-scheme:light;--bg:#fff;--fg:#1a1b1e;--muted:#4a4f57;--link:#0b5cad;--line:#d8dce1}
@media (prefers-color-scheme:dark){html[data-theme=auto]{color-scheme:dark;--bg:#1a1b1e;--fg:#f1f3f5;--muted:#b5bbc4;--link:#8ec5ff;--line:#3a3d44}}
html[data-theme=dark]{color-scheme:dark;--bg:#1a1b1e;--fg:#f1f3f5;--muted:#b5bbc4;--link:#8ec5ff;--line:#3a3d44}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;overflow-wrap:anywhere}
main{padding:12px}
h2{font-size:1.15rem;line-height:1.3;margin:0 0 .5rem}
a{color:var(--link)}
ol,ul{margin:.5rem 0;padding-left:1.25rem}
ul.items{list-style:none;padding:0}
.item{padding:.5rem 0;border-top:1px solid var(--line)}
.item p{margin:.25rem 0 0;color:var(--muted)}
.tag{font-size:.8rem;color:var(--muted)}
.note{color:var(--muted);font-size:.9rem}
footer{margin-top:1rem;padding-top:.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
footer p{margin:.25rem 0}
`.trim();

function renderIssue(m: EmbedModel, t: EmbedT): string {
  const issue = m.issue!;
  const date = formatIssueDate(issue.date, m.locale);
  const langAttr = issue.isFallback ? ` lang="${issue.displayedLocale}"` : '';
  const note = issue.isFallback
    ? `<p class="note" role="note">${escapeHtml(
        t(
          issue.translation.status === 'pending'
            ? 'Issue.translationPending'
            : 'Issue.translationUnavailable',
        ),
      )}</p>`
    : '';
  const points = issue.summary?.points.length
    ? `<ol${langAttr}>${issue.summary.points
        .map((p) => `<li>${escapeHtml(p.text)}</li>`)
        .join('')}</ol>`
    : '';
  const items = m.items.length
    ? `<ul class="items"${langAttr}>${m.items
        .map(
          (i) =>
            `<li class="item">${link(m.links.item(i.id), i.title, ' data-track="item"')}` +
            (i.isTrialRegistration
              ? ` <span class="tag">${escapeHtml(t('Issue.trialLabel'))}</span>`
              : '') +
            (i.sentence ? `<p class="sentence">${escapeHtml(i.sentence)}</p>` : '') +
            `</li>`,
        )
        .join('')}</ul>`
    : '';
  const more =
    m.moreCount > 0
      ? `<p>${link(m.links.issue, t('Widget.moreItems', { count: m.moreCount }), ' data-track="issue"')}</p>`
      : '';
  return (
    `<article aria-labelledby="w-heading">` +
    `<h2 id="w-heading">${link(
      m.links.issue,
      t('Widget.heading', { projectName: m.project.name, date }),
      ' data-track="issue"',
    )}</h2>${note}${points}${items}${more}` +
    `<p>${link(m.links.archive, t('Widget.allIssues'), ' data-track="archive"')}</p>` +
    `</article>`
  );
}

export function renderEmbed(m: EmbedModel, t: EmbedT): string {
  const body = m.issue ? renderIssue(m, t) : `<p>${escapeHtml(t('Widget.firstIssueComing'))}</p>`;
  return (
    `<!doctype html>\n<html lang="${m.locale}" data-theme="${m.options.theme}">` +
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${escapeHtml(
      t('Widget.frameTitle', { projectName: m.project.name }),
    )}</title><style>${CSS}</style></head>` +
    `<body><main>${body}<footer><p>${escapeHtml(t('Trust.disclaimer'))}</p><p>${escapeHtml(
      t('Trust.aiLabel'),
    )}</p></footer></main></body></html>`
  );
}

/** No project content, no script: the loader keeps the partner's fallback. */
export function renderEmbedNotFound(): string {
  return (
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="robots" content="noindex"><title>Not found</title></head><body></body></html>`
  );
}
