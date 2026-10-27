import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';
import { HTML_LIMITED_BOT_UA_RE } from 'next/dist/shared/lib/router/utils/html-bots.js';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  transpilePackages: ['@hht/shared'],
  // Keep this outside proxy.ts: its matcher excludes Payload admin and APIs.
  // Spec 014 must exclude only its concrete widget routes here when it adds
  // their per-project frame-ancestors allow-list. Until then, deny framing everywhere.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  // Setting htmlLimitedBots replaces Next's built-in list, so extend it rather than redefine it.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|TelegramBot|Viber`, 'i'),
  outputFileTracingIncludes: {
    '**/opengraph-image*': ['./assets/fonts/*.ttf'],
  },
  // rootParams (next/root-params) is enabled by default since Next.js 16.3.
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
  turbopack: {
    // Monorepo root so Next can resolve `next` from apps/web
    root: path.resolve(dirname, '../..'),
  },
};

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false });
