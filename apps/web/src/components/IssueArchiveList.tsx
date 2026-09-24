import type { IssueSummaryListItem } from '@/lib/issues';

type Props = {
  issues: IssueSummaryListItem[];
  projectSlug: string;
};

/** Archive list shell — styling and links are completed in US4 (T044). */
export function IssueArchiveList({ issues }: Props) {
  return (
    <ul>
      {issues.map((issue) => (
        <li key={issue.id}>{issue.excerpt ?? issue.date}</li>
      ))}
    </ul>
  );
}
