import { parsePubmedArticles } from './pubmed.js';

// Synthetic efetch XML shaped like PubMed's; content is illustrative only.
const STRUCTURED = `<?xml version="1.0" ?>
<PubmedArticleSet>
<PubmedArticle>
  <MedlineCitation Status="Publisher" Owner="NLM">
    <PMID Version="1">111</PMID>
    <Article PubModel="Print-Electronic">
      <Journal><JournalIssue><PubDate><Year>2027</Year><Month>Jan</Month></PubDate></JournalIssue></Journal>
      <ArticleTitle>Trial of <i>drug X</i> &amp; epistaxis</ArticleTitle>
      <Abstract>
        <AbstractText Label="BACKGROUND" NlmCategory="BACKGROUND">Background text.</AbstractText>
        <AbstractText Label="METHODS" NlmCategory="METHODS">Methods text with p &lt; 0.05.</AbstractText>
        <AbstractText Label="RESULTS" NlmCategory="RESULTS">Results text.</AbstractText>
      </Abstract>
      <PublicationTypeList>
        <PublicationType UI="D016449">Randomized Controlled Trial</PublicationType>
        <PublicationType UI="D016428">Journal Article</PublicationType>
      </PublicationTypeList>
      <ArticleDate DateType="Electronic"><Year>2026</Year><Month>09</Month><Day>10</Day></ArticleDate>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History>
      <PubMedPubDate PubStatus="entrez"><Year>2026</Year><Month>9</Month><Day>12</Day><Hour>6</Hour></PubMedPubDate>
    </History>
    <ArticleIdList>
      <ArticleId IdType="pubmed">111</ArticleId>
      <ArticleId IdType="doi">10.1000/xyz</ArticleId>
    </ArticleIdList>
  </PubmedData>
</PubmedArticle>
<PubmedArticle>
  <MedlineCitation Status="MEDLINE" Owner="NLM">
    <PMID Version="1">222</PMID>
    <Article PubModel="Print">
      <Journal><JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month><Day>3</Day></PubDate></JournalIssue></Journal>
      <ArticleTitle>Case report</ArticleTitle>
      <Abstract><AbstractText>Plain abstract.</AbstractText></Abstract>
      <PublicationTypeList><PublicationType UI="D002363">Case Reports</PublicationType></PublicationTypeList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History>
      <PubMedPubDate PubStatus="entrez"><Year>2026</Year><Month>8</Month><Day>20</Day></PubMedPubDate>
    </History>
  </PubmedData>
</PubmedArticle>
</PubmedArticleSet>`;

describe('parsePubmedArticles', () => {
  const [structured, plain] = parsePubmedArticles(STRUCTURED, 10);

  it('keeps every structured abstract section with its label', () => {
    expect(structured?.abstractOrBody).toBe(
      'BACKGROUND: Background text.\n\nMETHODS: Methods text with p < 0.05.\n\nRESULTS: Results text.',
    );
    expect(plain?.abstractOrBody).toBe('Plain abstract.');
  });

  it('strips inline markup and decodes entities in titles', () => {
    expect(structured?.title).toBe('Trial of drug X & epistaxis');
  });

  it('prefers the electronic article date, then the PubMed entry date', () => {
    expect(structured?.publishedOrUpdatedAt?.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(plain?.publishedOrUpdatedAt?.toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });

  it('captures publication types and ids', () => {
    expect(structured?.publicationTypes).toEqual([
      'Randomized Controlled Trial',
      'Journal Article',
    ]);
    expect(plain?.publicationTypes).toEqual(['Case Reports']);
    expect(structured?.externalIds).toEqual({ pmid: '111', doi: '10.1000/xyz' });
    expect(structured?.originalUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/111/');
  });

  it('respects the limit', () => {
    expect(parsePubmedArticles(STRUCTURED, 1)).toHaveLength(1);
  });
});
