export const CHAT_SOURCES = ['vk', 'wa', 'fb', 'tg'] as const;
export type KnownChatSource = (typeof CHAT_SOURCES)[number];
export type ChatSource = KnownChatSource | 'other';

/** Allow-list. Missing or unknown values are `other`. */
export function parseChatSource(value: string | null | undefined): ChatSource {
  if (value === 'vk' || value === 'wa' || value === 'fb' || value === 'tg') return value;
  return 'other';
}

export const PARTNER_SOURCE_PREFIX = 'site:';
export type PartnerSource = `site:${string}`;
export type SubscriptionSource = ChatSource | PartnerSource;

const PARTNER_SOURCE_RE = /^site:[a-z0-9][a-z0-9-]{1,31}$/;

/** Syntax-only check: chat source, well-formed `site:<key>`, otherwise `other`. */
export function parseSourceToken(value: string | null | undefined): SubscriptionSource {
  if (typeof value !== 'string') return 'other';
  const chat = parseChatSource(value);
  if (chat !== 'other') return chat;
  return PARTNER_SOURCE_RE.test(value) ? (value as PartnerSource) : 'other';
}

/** Like `parseSourceToken`, but a partner source must be configured for the project. */
export function resolveSubscriptionSource(
  value: string | null | undefined,
  partnerKeys: readonly string[],
): SubscriptionSource {
  const token = parseSourceToken(value);
  if (token.startsWith(PARTNER_SOURCE_PREFIX)) {
    return partnerKeys.includes(token.slice(PARTNER_SOURCE_PREFIX.length)) ? token : 'other';
  }
  return token;
}

export function partnerSource(key: string): PartnerSource {
  return `${PARTNER_SOURCE_PREFIX}${key}`;
}
