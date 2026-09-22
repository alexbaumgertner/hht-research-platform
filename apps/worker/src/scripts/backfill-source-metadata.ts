/**
 * One-off: re-read source metadata for publications already on the public feed —
 * dates (PubMed / ClinicalTrials.gov), full structured PubMed abstracts and
 * PubMed publication types. Summaries are not regenerated.
 *
 * Run in production with the job's secrets:
 *   gcloud run jobs execute hht-monitor-worker --region=europe-west1 \
 *     --args=dist/scripts/backfill-source-metadata.js --wait
 */
import { CmsClient } from '../cms/client.js';
import { fetchStudy, studyToCandidate } from '../adapters/clinicaltrials.js';
import { fetchPubmedXml, parsePubmedArticles } from '../adapters/pubmed.js';
import { logError, logInfo } from '../log.js';

const PUBMED_CHUNK = 100;

async function main(): Promise<void> {
  const cms = new CmsClient();
  const publications = await cms.listFeedPublications();
  let updated = 0;
  let failed = 0;

  const pubmed = publications.filter((p) => p.sourceType === 'pubmed' && p.externalIds?.pmid);
  for (let i = 0; i < pubmed.length; i += PUBMED_CHUNK) {
    const chunk = pubmed.slice(i, i + PUBMED_CHUNK);
    const pmids = chunk.map((p) => p.externalIds!.pmid!);
    const parsed = parsePubmedArticles(await fetchPubmedXml(pmids), pmids.length);
    const byPmid = new Map(parsed.map((a) => [a.externalIds.pmid, a]));

    for (const publication of chunk) {
      const article = byPmid.get(publication.externalIds!.pmid!);
      if (!article) continue;
      try {
        await cms.updatePublication(publication.id, {
          ...(article.abstractOrBody ? { abstractOrBody: article.abstractOrBody } : {}),
          ...(article.publishedOrUpdatedAt
            ? { publishedOrUpdatedAt: article.publishedOrUpdatedAt.toISOString() }
            : {}),
          publicationTypes: article.publicationTypes ?? [],
        });
        updated += 1;
      } catch (err) {
        failed += 1;
        logError('backfill-source-metadata: pubmed update failed', err, {
          publicationId: publication.id,
        });
      }
    }
  }

  const trials = publications.filter(
    (p) => p.sourceType === 'clinicaltrials' && p.externalIds?.nctId,
  );
  for (const publication of trials) {
    try {
      const candidate = studyToCandidate(await fetchStudy(publication.externalIds!.nctId!));
      if (!candidate?.publishedOrUpdatedAt) continue;
      await cms.updatePublication(publication.id, {
        publishedOrUpdatedAt: candidate.publishedOrUpdatedAt.toISOString(),
      });
      updated += 1;
    } catch (err) {
      failed += 1;
      logError('backfill-source-metadata: trial update failed', err, {
        publicationId: publication.id,
      });
    }
  }

  logInfo('backfill-source-metadata: done', {
    pubmed: pubmed.length,
    trials: trials.length,
    updated,
    failed,
  });
}

main().catch((err: unknown) => {
  logError('backfill-source-metadata: fatal', err);
  process.exit(1);
});
