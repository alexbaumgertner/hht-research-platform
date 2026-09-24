import { compareIssueItems, IMPORTANCE_RANK, type IssueOrderItem } from './issueOrder';

function order(items: IssueOrderItem[]): Array<string | number> {
  return [...items].sort(compareIssueItems).map((item) => item.id);
}

describe('IMPORTANCE_RANK', () => {
  it('ranks critical > high > medium > low', () => {
    expect(IMPORTANCE_RANK.critical).toBeGreaterThan(IMPORTANCE_RANK.high);
    expect(IMPORTANCE_RANK.high).toBeGreaterThan(IMPORTANCE_RANK.medium);
    expect(IMPORTANCE_RANK.medium).toBeGreaterThan(IMPORTANCE_RANK.low);
  });
});

describe('compareIssueItems', () => {
  it('orders by raw importance first, missing last', () => {
    expect(
      order([
        { id: 1, importance: 'low' },
        { id: 2, importance: null },
        { id: 3, importance: 'critical' },
        { id: 4, importance: 'medium' },
        { id: 5, importance: 'high' },
        { id: 6 },
      ]),
    ).toEqual([3, 5, 4, 1, 2, 6]);
  });

  it('orders equal importance by date, newest first', () => {
    expect(
      order([
        { id: 1, importance: 'high', publishedOrUpdatedAt: '2026-09-01T00:00:00.000Z' },
        { id: 2, importance: 'high', publishedOrUpdatedAt: new Date('2026-09-20T00:00:00.000Z') },
        { id: 3, importance: 'high', publishedOrUpdatedAt: '2026-09-10T00:00:00.000Z' },
      ]),
    ).toEqual([2, 3, 1]);
  });

  it('puts missing and invalid dates last within an importance level', () => {
    expect(
      order([
        { id: 1, importance: 'medium', publishedOrUpdatedAt: null },
        { id: 2, importance: 'medium', publishedOrUpdatedAt: '2026-09-01T00:00:00.000Z' },
        { id: 3, importance: 'medium', publishedOrUpdatedAt: 'not a date' },
        { id: 4, importance: 'medium' },
      ]),
    ).toEqual([2, 1, 3, 4]);
  });

  it('does not let a newer date outrank higher importance', () => {
    expect(
      order([
        { id: 1, importance: 'low', publishedOrUpdatedAt: '2026-09-20T00:00:00.000Z' },
        { id: 2, importance: 'high', publishedOrUpdatedAt: null },
      ]),
    ).toEqual([2, 1]);
  });

  it('breaks full ties by id ascending (numeric and string ids)', () => {
    const date = '2026-09-01T00:00:00.000Z';
    expect(
      order([
        { id: 10, importance: 'high', publishedOrUpdatedAt: date },
        { id: 2, importance: 'high', publishedOrUpdatedAt: date },
        { id: 7, importance: 'high', publishedOrUpdatedAt: date },
      ]),
    ).toEqual([2, 7, 10]);
    expect(order([{ id: 'b' }, { id: 'a' }, { id: 'c' }])).toEqual(['a', 'b', 'c']);
  });

  it('is stable regardless of input order', () => {
    const items: IssueOrderItem[] = [
      { id: 3, importance: 'high', publishedOrUpdatedAt: '2026-09-02T00:00:00.000Z' },
      { id: 1, importance: 'high', publishedOrUpdatedAt: '2026-09-02T00:00:00.000Z' },
      { id: 2, importance: 'critical', publishedOrUpdatedAt: null },
      { id: 4, publishedOrUpdatedAt: '2026-09-22T00:00:00.000Z' },
    ];
    expect(order(items)).toEqual([2, 1, 3, 4]);
    expect(order([...items].reverse())).toEqual([2, 1, 3, 4]);
  });
});
