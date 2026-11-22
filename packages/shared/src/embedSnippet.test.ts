import { buildIframeSnippet, buildScriptSnippet } from './embedSnippet';

const base = {
  siteUrl: 'https://hht.example.org',
  project: 'hht-research',
  partner: 'curehht-ru',
  locale: 'ru' as const,
};

describe('buildScriptSnippet', () => {
  const snippet = buildScriptSnippet({
    ...base,
    items: 3,
    theme: 'auto',
    subscribe: 'form',
    fallback: {
      sentence: 'Новости исследований простым языком.',
      communityLabel: 'Сообщество',
      communityUrl: 'https://vk.com/club1',
      subscribeLabel: 'Подписаться',
    },
  });

  it('matches the contract byte for byte', () => {
    expect(snippet).toBe(`<div
  data-digest-widget
  data-project="hht-research"
  data-partner="curehht-ru"
  data-locale="ru"
  data-items="3"
  data-theme="auto"
  data-subscribe="form"
>
  <!-- Fallback: shown until the widget is ready, and kept if it never is. -->
  <p>
    Новости исследований простым языком.
    <a href="https://vk.com/club1">Сообщество</a> ·
    <a href="https://hht.example.org/ru/projects/hht-research?src=site:curehht-ru#subscribe">Подписаться</a>
  </p>
</div>
<script async src="https://hht.example.org/embed/v1.js"></script>`);
  });

  it('omits the community link without a url', () => {
    const s = buildScriptSnippet({
      ...base,
      items: 5,
      theme: 'dark',
      subscribe: 'link',
      fallback: { sentence: 'Hi', communityLabel: 'Community', subscribeLabel: 'Subscribe' },
    });
    expect(s).not.toContain('Community');
    expect(s).toContain('data-items="5"');
    expect(s).toContain('data-subscribe="link"');
  });

  it('escapes all text and rejects non-https community urls', () => {
    const s = buildScriptSnippet({
      ...base,
      items: 3,
      theme: 'auto',
      subscribe: 'form',
      fallback: {
        sentence: '<b>"x"</b> & y',
        communityLabel: '<i>',
        communityUrl: 'javascript:alert(1)',
        subscribeLabel: "it's",
      },
    });
    expect(s).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y');
    expect(s).not.toContain('javascript:');
    expect(s).toContain('it&#39;s');
  });
});

describe('buildIframeSnippet', () => {
  it('builds the plain frame from the canonical options', () => {
    expect(
      buildIframeSnippet({
        ...base,
        options: { theme: 'auto', items: 3, mode: 'form' },
        title: 'Новости "исследований"',
        height: 900,
      }),
    ).toBe(`<iframe
  src="https://hht.example.org/embed/ru/hht-research/curehht-ru/auto-3-form"
  title="Новости &quot;исследований&quot;"
  width="100%"
  height="900"
  style="border:0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  loading="lazy"
></iframe>`);
  });
});
