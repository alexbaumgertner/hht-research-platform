import type { Importance } from './index.js';

/** Raw four-level importance; a missing value ranks below `low`. */
export const IMPORTANCE_RANK: Record<Importance, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type IssueOrderItem = {
  id: string | number;
  importance?: Importance | null;
  publishedOrUpdatedAt?: Date | string | null;
};

function importanceRank(value: Importance | null | undefined): number {
  return (value && IMPORTANCE_RANK[value]) || 0;
}

function timestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = (typeof value === 'string' ? new Date(value) : value).getTime();
  return Number.isNaN(time) ? null : time;
}

function compareIds(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Issue item order, shared by the worker's prompt numbering and the issue page
 * so "item 3" means the same material in both: importance desc, then
 * `publishedOrUpdatedAt` desc (nulls last), then id asc.
 */
export function compareIssueItems(a: IssueOrderItem, b: IssueOrderItem): number {
  const byImportance = importanceRank(b.importance) - importanceRank(a.importance);
  if (byImportance !== 0) return byImportance;

  const timeA = timestamp(a.publishedOrUpdatedAt);
  const timeB = timestamp(b.publishedOrUpdatedAt);
  if (timeA !== timeB) {
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeB - timeA;
  }

  return compareIds(a.id, b.id);
}
