import { buildIssueEmail, EMAIL_COPY } from './issueEmailBody';

const links = {
  issue: 'https://example.com/r/click-token/issue',
  privacy: 'https://example.com/r/click-token/privacy',
  unsubscribe: 'https://example.com/en/unsubscribe/token',
};

const issue = {
  date: '26 September 2026',
  summaryPoints: ['First summary point.', 'Second summary point.'],
  items: [
    {
      title: 'Study title',
      source: 'PubMed',
      date: '1 September 2026',
      sentence: 'A plain-language sentence about the study.',
      isTrial: false,
    },
    {
      title: 'Registry title',
      source: 'Clinical trials',
      date: '2 September 2026',
      sentence: 'The study is still recruiting.',
      isTrial: true,
    },
    {
      title: 'News title',
      source: 'News',
      date: '3 September 2026',
      sentence: 'A clinic opened.',
      isTrial: false,
    },
  ],
};

function withoutUrls(text: string): string {
  return text.replaceAll(/https?:\/\/\S+/g, '');
}

describe('buildIssueEmail', () => {
  it.each(['en', 'ru'] as const)(
    'keeps the %s body complete after every URL is removed',
    (language) => {
      const email = buildIssueEmail({
        issue,
        language,
        senderName: 'Weekly updates',
        links,
      });
      const plain = withoutUrls(email.text);
      expect(plain).toContain('Weekly updates');
      expect(plain).toContain(issue.date);
      for (const point of issue.summaryPoints) expect(plain).toContain(point);
      for (const item of issue.items) {
        expect(plain).toContain(item.title);
        expect(plain).toContain(item.source);
        expect(plain).toContain(item.date!);
        expect(plain).toContain(item.sentence);
      }
      expect(plain).toContain(EMAIL_COPY[language].trial);
      expect(plain).toContain(EMAIL_COPY[language].disclaimer);
      expect(plain).toContain(EMAIL_COPY[language].aiLabel);
      expect(email.html).toContain(issue.summaryPoints[0]);
      expect(email.html).toContain(links.issue);
    },
  );
});
