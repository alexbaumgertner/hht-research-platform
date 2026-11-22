import { embedPartnersOf, findEmbedPartner, partnerKeysOf } from './partners';

const project = {
  embedPartners: [
    {
      name: 'A',
      key: 'a1',
      origins: [{ origin: 'https://a.example' }],
      fallbackCommunityUrl: null,
    },
    { key: 'b2', origins: null },
    null,
    { name: 'no key' },
  ],
};

describe('embed partners', () => {
  it('reads partners defensively', () => {
    expect(partnerKeysOf(project)).toEqual(['a1', 'b2']);
    expect(findEmbedPartner(project, 'a1')?.origins).toEqual(['https://a.example']);
    expect(findEmbedPartner(project, 'b2')).toMatchObject({ name: 'b2', origins: [] });
    expect(findEmbedPartner(project, 'zz')).toBeNull();
  });
  it('tolerates missing data', () => {
    expect(embedPartnersOf({})).toEqual([]);
    expect(embedPartnersOf(null)).toEqual([]);
  });
});
