import type { Candidate, FetchCandidatesInput, SourceAdapter } from './types.js';
import { formatYmd, resolveSinceDate } from './types.js';
import { safeFetch } from '../net/safeFetch.js';

function buildQuery(keywords: string[]): string {
  return keywords.map((k) => `(${k})`).join(' OR ');
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

    const fetchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed` +
      `&retmode=xml&id=${ids.join(',')}`;
    const fetchRes = await safeFetch(fetchUrl);
    if (!fetchRes.ok) {
      throw new Error(`PubMed efetch failed: ${fetchRes.status}`);
    }
    const xml = await fetchRes.text();

    const articles: Candidate[] = [];
    const articleBlocks = xml.split('<PubmedArticle>').slice(1);
    for (const block of articleBlocks.slice(0, input.limit)) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
      const title =
        block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, '') ??
        'Untitled';
      const abstract =
        block
          .match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/)?.[1]
          ?.replace(/<[^>]+>/g, '') ?? undefined;
      const doi = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1];
      if (!pmid) continue;
      articles.push({
        externalIds: { pmid, doi },
        title,
        abstractOrBody: abstract,
        originalUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        sourceType: 'pubmed',
      });
    }
    return articles;
  },
};
