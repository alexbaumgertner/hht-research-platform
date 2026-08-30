import Parser from 'rss-parser';
import { sanitizeHttpUrl } from '@hht/shared';
import type { Candidate, FetchCandidatesInput, SourceAdapter } from './types.js';
import { resolveSinceDate } from './types.js';
import { safeFetch } from '../net/safeFetch.js';

const parser = new Parser();

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export const rssAdapter: SourceAdapter = {
  async fetchCandidates(input: FetchCandidatesInput): Promise<Candidate[]> {
    if (!input.rssUrl) {
      throw new Error('RSS URL is required');
    }

    const res = await safeFetch(input.rssUrl);
    if (!res.ok) {
      throw new Error(`RSS fetch failed: ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();
    const looksLikeFeed =
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom') ||
      body.includes('<rss') ||
      body.includes('<feed');
    if (!looksLikeFeed) {
      throw new Error('URL did not return a recognizable RSS/Atom feed');
    }

    const feed = await parser.parseString(body);
    const since = resolveSinceDate(input.since, input.bootstrapLookbackDays);
    const items: Candidate[] = [];

    for (const item of feed.items) {
      if (items.length >= input.limit) break;
      const title = item.title || 'Untitled';
      const description = item.contentSnippet || item.content || item.summary || '';
      const haystack = `${title}\n${description}`;
      if (!matchesKeywords(haystack, input.keywords)) continue;

      const pubDate = item.isoDate || item.pubDate;
      const published = pubDate ? new Date(pubDate) : undefined;
      if (published && published < since) continue;

      const link = sanitizeHttpUrl(item.link) ?? input.rssUrl;
      const guid = item.guid || item.id || link;
      items.push({
        externalIds: { guid: String(guid) },
        title,
        abstractOrBody: description,
        originalUrl: link,
        publishedOrUpdatedAt: published,
        sourceType: 'rss',
      });
    }

    return items;
  },
};
