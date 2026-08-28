import { capCreateDepth, resolveRelationshipId } from './digestHooks';

describe('resolveRelationshipId', () => {
  it('returns a raw id', () => {
    expect(resolveRelationshipId(12)).toBe(12);
    expect(resolveRelationshipId('abc')).toBe('abc');
  });

  it('unwraps a populated relationship object', () => {
    expect(resolveRelationshipId({ id: 7, name: 'HHT' })).toBe(7);
  });

  it('returns undefined for missing values', () => {
    expect(resolveRelationshipId(null)).toBeUndefined();
    expect(resolveRelationshipId(undefined)).toBeUndefined();
    expect(resolveRelationshipId({})).toBeUndefined();
  });
});

describe('capCreateDepth', () => {
  it('forces depth 0 on create even when the client omitted it', () => {
    expect(capCreateDepth({}, 'create')).toEqual({ depth: 0 });
    expect(capCreateDepth({ depth: 2 }, 'create')).toEqual({ depth: 0 });
  });

  it('leaves depth unchanged for update/delete', () => {
    expect(capCreateDepth({ depth: 2 }, 'update')).toEqual({ depth: 2 });
    expect(capCreateDepth({ depth: 2 }, 'delete')).toEqual({ depth: 2 });
  });
});
