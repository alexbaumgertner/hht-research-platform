import { canTriggerManualRun } from './manualRun';

describe('canTriggerManualRun', () => {
  it('denies missing user', () => {
    expect(canTriggerManualRun({ user: null, projectOwner: '1' })).toBe(false);
  });

  it('allows admin for any project', () => {
    expect(
      canTriggerManualRun({
        user: { id: '9', roles: ['admin'] },
        projectOwner: '1',
      }),
    ).toBe(true);
  });

  it('allows owner', () => {
    expect(
      canTriggerManualRun({
        user: { id: '1', roles: ['worker'] },
        projectOwner: '1',
      }),
    ).toBe(true);
    expect(
      canTriggerManualRun({
        user: { id: '1' },
        projectOwner: { id: '1' },
      }),
    ).toBe(true);
  });

  it('denies non-owner non-admin', () => {
    expect(
      canTriggerManualRun({
        user: { id: '2', roles: ['worker'] },
        projectOwner: '1',
      }),
    ).toBe(false);
  });
});
