import { ContentTranslations } from '../collections/ContentTranslations';
import { Digests } from '../collections/Digests';
import { MonitoredSources } from '../collections/MonitoredSources';
import { Publications } from '../collections/Publications';
import { ResearchProjects } from '../collections/ResearchProjects';

describe('public cache invalidation hooks', () => {
  // Public lists render fields from these collections (including a populated source's
  // displayCategory), so every one of them must drop the cached reads on change and delete.
  it.each([
    ['digests', Digests],
    ['publications', Publications],
    ['monitored-sources', MonitoredSources],
    ['research-projects', ResearchProjects],
    ['content-translations', ContentTranslations],
  ])('%s revalidates public content after change and delete', (_slug, collection) => {
    expect(collection.hooks?.afterChange?.length ?? 0).toBeGreaterThan(0);
    expect(collection.hooks?.afterDelete?.length ?? 0).toBeGreaterThan(0);
  });
});
