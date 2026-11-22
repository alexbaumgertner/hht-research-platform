import 'server-only';

import { LocaleSchema, parseEmbedOptions } from '@hht/shared';
import { getTranslations } from 'next-intl/server';

import { buildEmbedHeaders } from '@/lib/embed/embedHeaders';
import { loadEmbedModel } from '@/lib/embed/loadEmbedModel';
import { renderEmbed, renderEmbedNotFound, type EmbedT } from '@/lib/embed/renderEmbed';

export type EmbedParams = { locale: string; slug: string; partner: string; options: string };

function redirect(url: URL, path: string): Response {
  return new Response(null, {
    status: 308,
    headers: { Location: new URL(path, url).pathname, 'Cache-Control': 'public, max-age=300' },
  });
}

/** Shared by the ISR route handlers. Never reads cookies or the query string. */
export async function handleEmbedRequest(req: Request, p: EmbedParams): Promise<Response> {
  const url = new URL(req.url);
  const localeParsed = LocaleSchema.safeParse(p.locale);
  const parsedOptions = parseEmbedOptions(p.options);
  if (!localeParsed.success || parsedOptions.changed) {
    const locale = localeParsed.success ? localeParsed.data : 'en';
    return redirect(
      url,
      `/embed/${locale}/${encodeURIComponent(p.slug)}/${encodeURIComponent(p.partner)}/${parsedOptions.canonical}`,
    );
  }
  const locale = localeParsed.data;

  const model = await loadEmbedModel({
    slug: p.slug,
    partnerKey: p.partner,
    locale,
    options: parsedOptions.options,
  });
  if (!model) {
    return new Response(renderEmbedNotFound(), {
      status: 404,
      headers: buildEmbedHeaders({ origins: [] }),
    });
  }
  const t = (await getTranslations({ locale })) as unknown as EmbedT;
  return new Response(renderEmbed(model, t), {
    status: 200,
    headers: buildEmbedHeaders({ origins: model.partner.origins }),
  });
}
