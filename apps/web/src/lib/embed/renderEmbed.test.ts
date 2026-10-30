import type { IssueDetail } from '@/lib/issues';

import { renderEmbed, renderEmbedNotFound, type EmbedModel } from './renderEmbed';

const t = (key: string, values?: Record<string, string | number>) =>
  `[${key}${values ? ' ' + Object.values(values).join(',') : ''}]`;

const SITE = 'https://site.example';

function item(i: number, over: Partial<IssueDetail['items'][number]> = {}) {
  return {
    id: String(i),
    title: `Title ${i}`,
    source: 'pubmed',
    importance: 'standard',
    date: null,
    isTrialRegistration: false,
    sentence: `Sentence ${i}`,
    ...over,
  } as IssueDetail['items'][number];
}

function model(over: Partial<EmbedModel> = {}, issue: Partial<IssueDetail> = {}): EmbedModel {
  const items = Array.from({ length: 7 }, (_, i) => item(i + 1));
  const detail: IssueDetail = {
    id: '9',
    date: '2026-03-01T00:00:00.000Z',
    project: { slug: 'proj', name: 'Proj' },
    summary: { points: [{ text: 'Point one', itemIds: [] }] },
    items,
    displayedLocale: 'ru',
    isFallback: false,
    translation: { status: 'ready' },
    meta: { title: '', description: '' },
    ...issue,
  };
  return {
    locale: 'ru',
    options: { theme: 'auto', items: 3, mode: 'form' },
    project: { id: 1, slug: 'proj', name: 'Proj' },
    partner: { key: 'acme', name: 'Acme', origins: ['https://acme.example'] },
    issue: detail,
    items: detail.items.slice(0, 3),
    moreCount: detail.items.length - 3,
    periodReview: null,
    source: 'site:acme',
    links: {
      issue: `${SITE}/ru/projects/proj/issues/9?src=site:acme`,
      archive: `${SITE}/ru/projects/proj/issues?src=site:acme`,
      subscribe: `${SITE}/ru/projects/proj?src=site:acme#subscribe`,
      privacy: `${SITE}/ru/privacy`,
      item: (id: string) => `${SITE}/ru/projects/proj/publications/${id}?src=site:acme`,
    },
    ...over,
  };
}

describe('renderEmbed', () => {
  it('escapes hostile text and rejects non-http urls', () => {
    const evil = `<script>alert(1)</script> "q" 'a' &`;
    const m = model({ project: { id: 1, slug: 'proj', name: evil } });
    m.items = [item(1, { title: evil, sentence: evil })];
    m.issue = { ...m.issue!, summary: { points: [{ text: evil, itemIds: [] }] } };
    m.links.item = () => 'javascript:alert(1)';
    const html = renderEmbed(m, t);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows disclaimer and AI label with an issue and without one', () => {
    for (const m of [model(), model({ issue: null, items: [], moreCount: 0 })]) {
      const html = renderEmbed(m, t);
      expect(html).toContain('[Trust.disclaimer]');
      expect(html).toContain('[Trust.aiLabel]');
    }
    const empty = renderEmbed(model({ issue: null, items: [], moreCount: 0 }), t);
    expect(empty).toContain('[Widget.firstIssueComing]');
    expect(empty).not.toContain('<article');
  });

  it('limits items and shows a more link only when needed', () => {
    const html = renderEmbed(model(), t);
    expect(html.match(/<li class="item"/g)).toHaveLength(3);
    expect(html).toContain('[Widget.moreItems 4]');

    const two = model({ moreCount: 0 });
    two.items = [item(1), item(2)];
    const html2 = renderEmbed(two, t);
    expect(html2.match(/<li class="item"/g)).toHaveLength(2);
    expect(html2).not.toContain('Widget.moreItems');
  });

  it('marks the English fallback', () => {
    const m = model(
      {},
      { isFallback: true, displayedLocale: 'en', translation: { status: 'pending' } },
    );
    const html = renderEmbed(m, t);
    expect(html).toContain('role="note"');
    expect(html).toContain('[Issue.translationPending]');
    expect(html).toContain('lang="en"');
  });

  it('renders titles and links without summary or sentences when text failed', () => {
    const m = model({}, { summary: null });
    m.items = m.items.map((i) => ({ ...i, sentence: null }));
    const html = renderEmbed(m, t);
    expect(html).toContain('Title 1');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('class="sentence"');
    expect(html).toContain('[Trust.disclaimer]');
  });

  it('opens outbound links in a new tab, with src, except privacy', () => {
    const html = renderEmbed(model(), t);
    const anchors = html.match(/<a [^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(3);
    for (const a of anchors) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener"');
      expect(a).toMatch(/href="https:\/\/site\.example\//);
      if (!a.includes('/privacy')) expect(a).toContain('src=site:acme');
    }
  });

  it('renders no review link or placeholder without a period review', () => {
    expect(renderEmbed(model(), t)).not.toContain('Widget.periodReview');
  });

  it('sets html lang and theme', () => {
    const html = renderEmbed(model({ options: { theme: 'dark', items: 3, mode: 'form' } }), t);
    expect(html).toContain('<html lang="ru" data-theme="dark">');
  });
});

describe('renderEmbedNotFound', () => {
  it('has no project content and no script', () => {
    const html = renderEmbedNotFound();
    expect(html).not.toContain('<script');
    expect(html).toContain('<!doctype html>');
  });
});
