/**
 * One-off: generate missing content-translations for publications already on
 * the public feed (e.g. items published before translation pre-generation ran).
 *
 * Run in production with the job's secrets:
 *   gcloud run jobs execute hht-monitor-worker --region=europe-west1 \
 *     --args=dist/scripts/backfill-translations.js --wait
 */
import { CONTENT_TRANSLATION_LOCALES } from '@hht/shared';

import { CmsClient } from '../cms/client.js';
import { logError, logInfo } from '../log.js';
import { translateSummary } from '../pipeline/translate.js';
import { completeSummary, missingTranslations } from './backfill.js';

async function main(): Promise<void> {
  const cms = new CmsClient();
  const publications = await cms.listFeedPublications();
  const todo = missingTranslations(
    publications,
    await cms.listTranslations(),
    CONTENT_TRANSLATION_LOCALES,
  );
  logInfo('backfill-translations: start', {
    publications: publications.length,
    missing: todo.length,
  });

  let created = 0;
  for (const { publication, locale } of todo) {
    const summary = completeSummary(publication.summary);
    if (!summary) continue;
    try {
      const { title, ...fields } = await translateSummary(
        publication.title,
        summary,
        locale as (typeof CONTENT_TRANSLATION_LOCALES)[number],
      );
      await cms.createContentTranslation({ publication: publication.id, locale, title, fields });
      created += 1;
    } catch (err) {
      logError('backfill-translations: failed', err, { publicationId: publication.id, locale });
    }
  }
  logInfo('backfill-translations: done', { created, failed: todo.length - created });
}

main().catch((err: unknown) => {
  logError('backfill-translations: fatal', err);
  process.exit(1);
});
