import {
  EMAIL_COPY,
  RUSSIAN_FALLBACK_NOTE,
  type EmailLanguage,
  type IssueEmailItem,
} from './issueEmailBody.js';

export const CHAT_CHANNELS = ['vk', 'telegram', 'whatsapp', 'facebook'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export const CHAT_LIMITS: Record<ChatChannel, number> = {
  vk: 16384,
  telegram: 4096,
  whatsapp: 65536,
  facebook: 63206,
};

const CHANNEL_SRC = {
  vk: 'vk',
  telegram: 'tg',
  whatsapp: 'wa',
  facebook: 'fb',
} as const;

export type ChatPost = {
  channel: ChatChannel;
  language: EmailLanguage;
  text: string;
};

export type ChatIssueText = {
  summaryPoints: string[];
  items: IssueEmailItem[];
};

function moreLine(language: EmailLanguage, count: number): string {
  if (language === 'ru') return `Ещё ${count} в полном выпуске.`;
  return `${count} more items are in the full issue.`;
}

function renderPost(input: {
  projectName: string;
  issueDate: string;
  language: EmailLanguage;
  summaryPoints: string[];
  items: IssueEmailItem[];
  extraCount: number;
  disclaimer: string;
  issueUrl: string;
  subscribeUrl: string;
  russianFallback: boolean;
}): string {
  const copy = EMAIL_COPY[input.language];
  const lines = [input.projectName, input.issueDate, ''];
  for (const point of input.summaryPoints) lines.push(point);
  if (input.summaryPoints.length > 0) lines.push('');
  for (const item of input.items) {
    lines.push(item.title);
    lines.push(item.date ? `${item.source} · ${item.date}` : item.source);
    lines.push(item.sentence);
    if (item.isTrial) lines.push(copy.trial);
    lines.push('');
  }
  if (input.extraCount > 0) lines.push(moreLine(input.language, input.extraCount), '');
  lines.push(input.disclaimer);
  if (input.russianFallback) lines.push(RUSSIAN_FALLBACK_NOTE);
  lines.push(input.issueUrl, input.subscribeUrl);
  return lines.join('\n');
}

function fitPost(
  base: Omit<Parameters<typeof renderPost>[0], 'items' | 'extraCount'>,
  included: IssueEmailItem[],
  extraCount: number,
  limit: number,
): string {
  const items = [...included];
  let extra = extraCount;
  let text = renderPost({ ...base, items, extraCount: extra });
  while (text.length > limit && items.length > 0) {
    items.pop();
    extra += 1;
    text = renderPost({ ...base, items, extraCount: extra });
  }
  return text;
}

function postsForLanguage(input: {
  projectName: string;
  issueDate: string;
  language: EmailLanguage;
  text: ChatIssueText;
  disclaimer: string;
  issueUrl: (src: string) => string;
  subscribeUrl: (src: string) => string;
  russianFallback: boolean;
}): ChatPost[] {
  return CHAT_CHANNELS.map((channel) => {
    const src = CHANNEL_SRC[channel];
    const takeAll = channel === 'vk';
    const included = takeAll ? input.text.items : input.text.items.slice(0, 3);
    const extraCount = input.text.items.length - included.length;
    const text = fitPost(
      {
        projectName: input.projectName,
        issueDate: input.issueDate,
        language: input.language,
        summaryPoints: input.text.summaryPoints,
        disclaimer: input.disclaimer,
        issueUrl: input.issueUrl(src),
        subscribeUrl: input.subscribeUrl(src),
        russianFallback: input.russianFallback,
      },
      included,
      extraCount,
      CHAT_LIMITS[channel],
    );
    return { channel, language: input.language, text };
  });
}

/** Eight plain-text posts: each chat, in Russian and English. */
export function buildChatPosts(input: {
  projectName: string;
  issueDate: string;
  english: ChatIssueText;
  russian: ChatIssueText;
  issueUrl: (src: string) => string;
  subscribeUrl: (src: string) => string;
  /** When set, that language's posts use the English items plus the Russian note. */
  russianFallback?: boolean;
}): ChatPost[] {
  const english = postsForLanguage({
    projectName: input.projectName,
    issueDate: input.issueDate,
    language: 'en',
    text: input.english,
    disclaimer: EMAIL_COPY.en.disclaimer,
    issueUrl: input.issueUrl,
    subscribeUrl: input.subscribeUrl,
    russianFallback: false,
  });
  const russianBody = input.russianFallback ? input.english : input.russian;
  const russian = postsForLanguage({
    projectName: input.projectName,
    issueDate: input.issueDate,
    language: 'ru',
    text: russianBody,
    disclaimer: input.russianFallback ? EMAIL_COPY.en.disclaimer : EMAIL_COPY.ru.disclaimer,
    issueUrl: input.issueUrl,
    subscribeUrl: input.subscribeUrl,
    russianFallback: Boolean(input.russianFallback),
  });
  return [...english, ...russian];
}

export function formatOwnerKit(posts: ChatPost[]): { text: string; html: string } {
  const blocks = posts.map((post) => {
    const heading = `${post.channel} (${post.language})`;
    return { heading, text: post.text };
  });
  const text = blocks.map((block) => `${block.heading}\n\n${block.text}`).join('\n\n');
  const html = blocks
    .map(
      (block) =>
        `<h2>${block.heading}</h2><pre>${block.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre>`,
    )
    .join('\n');
  return { text, html };
}
