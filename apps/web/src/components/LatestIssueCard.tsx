import type { IssueSummaryListItem } from '@/lib/issues';

type Props = {
  issue: IssueSummaryListItem | null;
  projectSlug: string;
};

/** Latest-issue card shell — styling and links are completed in US4 (T044). */
export function LatestIssueCard({ issue }: Props) {
  if (!issue) return null;
  return <div>{issue.excerpt ?? issue.date}</div>;
}
