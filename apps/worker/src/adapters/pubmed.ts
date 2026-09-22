import type { Candidate, FetchCandidatesInput, SourceAdapter } from './types.js';
import { formatYmd, resolveSinceDate } from './types.js';
import { safeFetch } from '../net/safeFetch.js';

function buildQuery(keywords: string[]): string {
  return keywords.map((k) => `(${k})`).join(' OR ');
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Inner text of an XML fragment: tags stripped, entities decoded, whitespace collapsed. */
function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** `<Year>/<Month>/<Day>` inside a date element → UTC date; month may be numeric or "Sep". */
function parseDateElement(fragment: string | undefined): Date | undefined {
  if (!fragment) return undefined;
  const year = Number(fragment.match(/<Year>(\d{4})<\/Year>/)?.[1]);
  if (!year) return undefined;
  const rawMonth = fragment.match(/<Month>([^<]+)<\/Month>/)?.[1]?.trim() ?? '1';
  const month = Number(rawMonth) || MONTHS[rawMonth.slice(0, 3).toLowerCase()] || 1;
  const day = Number(fragment.match(/<Day>(\d{1,2})<\/Day>/)?.[1]) || 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Reader-facing date: electronic publication, else when PubMed received it,
 * else the journal issue date (often in the future for ahead-of-print).
 */
function parsePublishedDate(block: string): Date | undefined {
  const electronic = block.match(
    /<ArticleDate DateType="Electronic">([\s\S]*?)<\/ArticleDate>/,
  )?.[1];
  const entrez = block.match(/<PubMedPubDate PubStatus="entrez">([\s\S]*?)<\/PubMedPubDate>/)?.[1];
  const issue = block.match(/<PubDate>([\s\S]*?)<\/PubDate>/)?.[1];
  return parseDateElement(electronic) ?? parseDateElement(entrez) ?? parseDateElement(issue);
}

/** All `<AbstractText>` sections; structured ones keep their label ("METHODS: …"). */
function parseAbstract(block: string): string | undefined {
  const sections = [...block.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map(
    ([, attrs, body]) => {
      const label = attrs?.match(/Label="([^"]+)"/)?.[1];
      const text = textOf(body ?? '');
      return label ? `${label}: ${text}` : text;
    },
  );
  const joined = sections.filter(Boolean).join('\n\n');
  return joined || undefined;
}

export function parsePubmedArticles(xml: string, limit: number): Candidate[] {
  const articles: Candidate[] = [];
  for (const block of xml.split('<PubmedArticle>').slice(1, limit + 1)) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const rawTitle = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1];
    const doi = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1];
    const publicationTypes = [
      ...block.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g),
    ].map(([, type]) => textOf(type ?? ''));

    articles.push({
      externalIds: doi ? { pmid, doi } : { pmid },
      title: (rawTitle && textOf(rawTitle)) || 'Untitled',
      abstractOrBody: parseAbstract(block),
      originalUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      publishedOrUpdatedAt: parsePublishedDate(block),
      publicationTypes,
      sourceType: 'pubmed',
    });
  }
  return articles;
}

export async function fetchPubmedXml(pmids: string[]): Promise<string> {
  const fetchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed` +
    `&retmode=xml&id=${pmids.join(',')}`;
  const fetchRes = await safeFetch(fetchUrl);
  if (!fetchRes.ok) {
    throw new Error(`PubMed efetch failed: ${fetchRes.status}`);
  }
  return fetchRes.text();
}

export const pubmedAdapter: SourceAdapter = {
  async fetchCandidates(input: FetchCandidatesInput): Promise<Candidate[]> {
    const since = resolveSinceDate(input.since, input.bootstrapLookbackDays);
    const mindate = formatYmd(since);
    const maxdate = formatYmd(new Date());
    const term = encodeURIComponent(buildQuery(input.keywords));
    const searchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed` +
      `&retmode=json&retmax=${input.limit}&term=${term}` +
      `&datetype=edat&mindate=${mindate}&maxdate=${maxdate}`;

    const searchRes = await safeFetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`PubMed esearch failed: ${searchRes.status}`);
    }
    const searchJson = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const ids = searchJson.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    return parsePubmedArticles(await fetchPubmedXml(ids), input.limit);
  },
};
