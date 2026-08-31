import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  transpilePackages: ['@hht/shared'],
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
