import { CHAT_LIMITS, buildChatPosts } from './chatPost';
import { EMAIL_COPY, RUSSIAN_FALLBACK_NOTE } from './issueEmailBody';

function item(index: number, sentence = `Sentence ${index}.`) {
  return {
    title: `Title ${index}`,
    source: 'PubMed',
    date: `2026-09-0${(index % 9) + 1}`,
    sentence,
    isTrial: index === 2,
  };
}

const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => item(n));

function posts() {
  return buildChatPosts({
    projectName: 'Weekly updates',
    issueDate: '26 September 2026',
    english: {
      summaryPoints: ['Point one.', 'Point two.'],
      items: seven,
    },
    russian: {
      summaryPoints: ['Пункт один.', 'Пункт два.'],
      items: seven.map((row) => ({ ...row, title: `Заголовок ${row.title}` })),
    },
    issueUrl: (src) => `https://example.com/en/projects/demo/issues/1?src=${src}`,
    subscribeUrl: (src) => `https://example.com/en/projects/demo?src=${src}#subscribe`,
  });
}

describe('buildChatPosts', () => {
  it('returns eight posts', () => {
    expect(posts()).toHaveLength(8);
  });

  it('includes every item in the VK post and the first 3 elsewhere, with a more line', () => {
    const all = posts();
    const vk = all.find((post) => post.channel === 'vk' && post.language === 'en')!;
    for (const row of seven) expect(vk.text).toContain(row.title);
    expect(vk.text).not.toContain('more items');
    expect(vk.text).toContain('src=vk');
    expect(vk.text).toContain(EMAIL_COPY.en.disclaimer);

    const telegram = all.find((post) => post.channel === 'telegram' && post.language === 'ru')!;
    expect(telegram.text).toContain('Title 1');
    expect(telegram.text).toContain('Title 3');
    expect(telegram.text).not.toContain('Title 4');
    expect(telegram.text).toContain('Ещё 4 в полном выпуске.');
    expect(telegram.text).toContain('src=tg');
    expect(telegram.text.length).toBeLessThanOrEqual(CHAT_LIMITS.telegram);
  });

  it('drops the lowest-ranked included items when the post is over the limit and keeps the summary and links', () => {
    const long = 'x'.repeat(2000);
    const items = [1, 2, 3, 4].map((n) => item(n, long));
    const built = buildChatPosts({
      projectName: 'Weekly updates',
      issueDate: '26 September 2026',
      english: { summaryPoints: ['Keep this summary.'], items },
      russian: { summaryPoints: ['Кратко.'], items },
      issueUrl: (src) => `https://example.com/issue?src=${src}`,
      subscribeUrl: (src) => `https://example.com/subscribe?src=${src}`,
    });
    const telegram = built.find((post) => post.channel === 'telegram' && post.language === 'en')!;
    expect(telegram.text.length).toBeLessThanOrEqual(CHAT_LIMITS.telegram);
    expect(telegram.text).toContain('Keep this summary.');
    expect(telegram.text).toContain(EMAIL_COPY.en.disclaimer);
    expect(telegram.text).toContain('src=tg');
    expect(telegram.text).toContain('more items are in the full issue.');
    expect(telegram.text).not.toContain('Title 4');
  });

  it('omits the more line when every included item fits and none were left out', () => {
    const built = buildChatPosts({
      projectName: 'Weekly updates',
      issueDate: '26 September 2026',
      english: { summaryPoints: ['One.'], items: [item(1), item(2)] },
      russian: { summaryPoints: ['Один.'], items: [item(1)] },
      issueUrl: (src) => `https://example.com/issue?src=${src}`,
      subscribeUrl: (src) => `https://example.com/subscribe?src=${src}`,
    });
    const telegram = built.find((post) => post.channel === 'telegram' && post.language === 'en')!;
    expect(telegram.text).not.toContain('more items');
  });

  it('adds the Russian note on a fallback post', () => {
    const built = buildChatPosts({
      projectName: 'Weekly updates',
      issueDate: '26 September 2026',
      english: { summaryPoints: ['English point.'], items: [item(1)] },
      russian: { summaryPoints: ['Не используется.'], items: [item(1)] },
      issueUrl: (src) => `https://example.com/issue?src=${src}`,
      subscribeUrl: (src) => `https://example.com/subscribe?src=${src}`,
      russianFallback: true,
    });
    const vk = built.find((post) => post.channel === 'vk' && post.language === 'ru')!;
    expect(vk.text).toContain('English point.');
    expect(vk.text).toContain(RUSSIAN_FALLBACK_NOTE);
  });
});
