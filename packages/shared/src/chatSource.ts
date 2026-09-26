export const CHAT_SOURCES = ['vk', 'wa', 'fb', 'tg'] as const;
export type KnownChatSource = (typeof CHAT_SOURCES)[number];
export type ChatSource = KnownChatSource | 'other';

/** Allow-list. Missing or unknown values are `other`. */
export function parseChatSource(value: string | null | undefined): ChatSource {
  if (value === 'vk' || value === 'wa' || value === 'fb' || value === 'tg') return value;
  return 'other';
}
