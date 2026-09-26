export type ClickRow = {
  language: 'en' | 'ru';
  slug: string;
  digestId: string;
  source: string;
  clicked: boolean;
};

export function clickDestination(input: {
  siteUrl: string;
  target: string;
  row: ClickRow | null;
}): string {
  const site = input.siteUrl.replace(/\/$/, '');
  if (!input.row) return site;
  const { language, slug, digestId, source } = input.row;
  if (input.target === 'issue') return `${site}/${language}/projects/${slug}/issues/${digestId}`;
  if (input.target === 'privacy') return `${site}/${language}/privacy`;
  if (input.target === 'subscribe') {
    return `${site}/${language}/projects/${slug}?src=${encodeURIComponent(source)}#subscribe`;
  }
  return site;
}

export async function resolveClickRedirect(input: {
  siteUrl: string;
  target: string;
  row: ClickRow | null;
  markClicked: () => Promise<void>;
}): Promise<{ status: 302; location: string }> {
  const location = clickDestination({
    siteUrl: input.siteUrl,
    target: input.target,
    row: input.row,
  });
  if (
    input.row &&
    !input.row.clicked &&
    (input.target === 'issue' || input.target === 'privacy' || input.target === 'subscribe')
  ) {
    try {
      await input.markClicked();
    } catch {
      // A failed flag write still redirects.
    }
  }
  return { status: 302, location };
}
