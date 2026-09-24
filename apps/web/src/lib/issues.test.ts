import type { IssueDigestDoc, IssueProjectDoc, IssuePublicationDoc } from '@/lib/issueTypes';
import {
  buildIssueMetaDescription,
  buildIssueMetaTitle,
  toIssueDetail,
  toIssueSummaryListItem,
  truncateDescription,
} from '@/lib/issues';

const project: IssueProjectDoc = {
  id: 1,
  slug: 'hht-research',
  name: 'HHT Research',
};

const publications: IssuePublicationDoc[] = [
  {
    id: '10',
    title: 'Study A',
    sourceType: 'pubmed',
    importance: 'high',
    publishedOrUpdatedAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: '11',
    title: 'Trial B',
    sourceType: 'clinicaltrials',
    importance: 'medium',
    publishedOrUpdatedAt: '2026-08-18T10:00:00.000Z',
  },
];

const readyDigest: IssueDigestDoc = {
  id: '99',
  publishedAt: '2026-09-28T12:00:00.000Z',
  issueSummaryPoints: [
    { text: 'First summary point about new findings.', items: ['10', '11'] },
    { text: 'Second point about care.', items: ['10'] },
    { text: 'Third point for families.', items: ['11'] },
  ],
  issueItemSentences: [
    { publication: '10', sentence: 'Researchers studied a possible treatment.' },
    { publication: '11', sentence: 'A study is recruiting participants.' },
  ],
  publications: ['10', '11'],
};

const pendingDigest: IssueDigestDoc = {
  id: '100',
  publishedAt: '2026-09-21T12:00:00.000Z',
  issueTextStatus: 'pending',
  publications: ['10'],
};

describe('truncateDescription', () => {
  it('returns short text unchanged', () => {
    expect(truncateDescription('Short text.')).toBe('Short text.');
  });

  it('cuts at a word boundary to 160 characters', () => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    const result = truncateDescription(words);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith('word')).toBe(false);
    expect(words.startsWith(result)).toBe(true);
  });
});

describe('toIssueSummaryListItem', () => {
  it('maps excerpt from the first summary point', () => {
    const item = toIssueSummaryListItem(readyDigest, publications, 'en');
    expect(item).toMatchObject({
      id: '99',
      itemCount: 2,
      excerpt: 'First summary point about new findings.',
      displayedLocale: 'en',
      isFallback: false,
    });
  });

  it('marks non-English archive rows as English fallback', () => {
    const item = toIssueSummaryListItem(readyDigest, publications, 'de');
    expect(item.isFallback).toBe(true);
    expect(item.displayedLocale).toBe('en');
  });
});

describe('toIssueDetail', () => {
  it('maps summary, items, and meta fields', () => {
    const detail = toIssueDetail(
      {
        digest: readyDigest,
        project,
        publications,
        translationByPubId: new Map(),
      },
      'en',
    );

    expect(detail.summary?.points).toHaveLength(3);
    expect(detail.items).toHaveLength(2);
    expect(detail.items[0]).toMatchObject({
      id: '10',
      isTrialRegistration: false,
      sentence: 'Researchers studied a possible treatment.',
    });
    expect(detail.items[1]).toMatchObject({
      id: '11',
      isTrialRegistration: true,
    });
    expect(detail.translation.status).toBe('not-needed');
    expect(detail.meta.title).toContain('HHT Research');
    expect(detail.meta.description).toBe('First summary point about new findings.');
    expect(detail.meta.description.length).toBeLessThanOrEqual(160);
  });

  it('returns summary null when no English points exist', () => {
    const detail = toIssueDetail(
      {
        digest: pendingDigest,
        project,
        publications: [publications[0]],
        translationByPubId: new Map(),
      },
      'en',
    );

    expect(detail.summary).toBeNull();
    expect(detail.meta.description).toContain('HHT Research');
  });

  it('uses fallback meta description when summary is unavailable', () => {
    const detail = toIssueDetail(
      {
        digest: pendingDigest,
        project,
        publications: [publications[0]],
        translationByPubId: new Map(),
      },
      'ru',
    );

    expect(detail.summary).toBeNull();
    expect(detail.meta.description).toContain('HHT Research');
    expect(buildIssueMetaTitle(project.name, pendingDigest.publishedAt, 'ru')).toContain(
      'обновление',
    );
    expect(
      buildIssueMetaDescription({
        locale: 'ru',
        projectName: project.name,
        itemCount: 1,
        firstSummaryPoint: null,
      }),
    ).toContain('материал');
  });
});
