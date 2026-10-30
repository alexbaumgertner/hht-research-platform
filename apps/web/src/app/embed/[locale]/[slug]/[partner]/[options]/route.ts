import { handleEmbedRequest, type EmbedParams } from '@/lib/embed/handleEmbedRequest';

export const dynamic = 'force-static';
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function GET(req: Request, { params }: { params: Promise<EmbedParams> }) {
  return handleEmbedRequest(req, await params);
}
