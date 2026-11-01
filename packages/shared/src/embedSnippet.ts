import { formatEmbedOptions, type EmbedMode, type EmbedOptions, type EmbedTheme } from './embed.js';
import type { Locale } from './index.js';

const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

type Target = { siteUrl: string; project: string; partner: string; locale: Locale };

export function buildScriptSnippet(
  input: Target & {
    items: number;
    theme: EmbedTheme;
    subscribe: EmbedMode;
    fallback: {
      sentence: string;
      communityLabel: string;
      communityUrl?: string;
      subscribeLabel: string;
    };
  },
): string {
  const site = input.siteUrl.replace(/\/$/, '');
  const subscribeUrl = `${site}/${input.locale}/projects/${input.project}?src=site:${input.partner}#subscribe`;
  const community = httpsUrl(input.fallback.communityUrl);
  const links = [
    ...(community
      ? [`<a href="${esc(community)}">${esc(input.fallback.communityLabel)}</a> ·`]
      : []),
    `<a href="${esc(subscribeUrl)}">${esc(input.fallback.subscribeLabel)}</a>`,
  ];
  return [
    '<div',
    '  data-digest-widget',
    `  data-project="${esc(input.project)}"`,
    `  data-partner="${esc(input.partner)}"`,
    `  data-locale="${input.locale}"`,
    `  data-items="${input.items}"`,
    `  data-theme="${input.theme}"`,
    `  data-subscribe="${input.subscribe}"`,
    '>',
    '  <!-- Fallback: shown until the widget is ready, and kept if it never is. -->',
    '  <p>',
    `    ${esc(input.fallback.sentence)}`,
    ...links.map((l) => `    ${l}`),
    '  </p>',
    '</div>',
    `<script async src="${esc(site)}/embed/v1.js"></script>`,
  ].join('\n');
}

export function buildIframeSnippet(
  input: Target & { options: EmbedOptions; title: string; height: number },
): string {
  const site = input.siteUrl.replace(/\/$/, '');
  const src = `${site}/embed/${input.locale}/${input.project}/${input.partner}/${formatEmbedOptions(input.options)}`;
  return [
    '<iframe',
    `  src="${esc(src)}"`,
    `  title="${esc(input.title)}"`,
    '  width="100%"',
    `  height="${input.height}"`,
    '  style="border:0"',
    `  sandbox="${SANDBOX}"`,
    '  loading="lazy"',
    '></iframe>',
  ].join('\n');
}
