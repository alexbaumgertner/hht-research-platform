export type EmbedPartner = {
  name: string;
  key: string;
  origins: string[];
  fallbackCommunityUrl: string | null;
};

type RawPartner = {
  name?: unknown;
  key?: unknown;
  origins?: Array<{ origin?: unknown } | null> | null;
  fallbackCommunityUrl?: unknown;
};

/** Reads `embedPartners` defensively: generated types may lag the collection. */
export function embedPartnersOf(project: unknown): EmbedPartner[] {
  const raw = (project as { embedPartners?: RawPartner[] | null } | null)?.embedPartners;
  if (!Array.isArray(raw)) return [];
  const partners: EmbedPartner[] = [];
  for (const row of raw) {
    if (!row || typeof row.key !== 'string') continue;
    partners.push({
      name: typeof row.name === 'string' ? row.name : row.key,
      key: row.key,
      origins: (row.origins ?? [])
        .map((o) => o?.origin)
        .filter((o): o is string => typeof o === 'string'),
      fallbackCommunityUrl:
        typeof row.fallbackCommunityUrl === 'string' ? row.fallbackCommunityUrl : null,
    });
  }
  return partners;
}

export function partnerKeysOf(project: unknown): string[] {
  return embedPartnersOf(project).map((p) => p.key);
}

export function findEmbedPartner(project: unknown, key: string): EmbedPartner | null {
  return embedPartnersOf(project).find((p) => p.key === key) ?? null;
}
