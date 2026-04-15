import createNextIntlPlugin from 'next-intl/plugin';

const API_BACKEND = process.env.API_BACKEND_URL || 'http://localhost:3000';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 moved turbopack config from experimental.turbo to top-level turbopack.
  // next-intl's plugin sets the alias via experimental.turbo (now ignored), so we
  // must manually add the alias here so next-intl can find its config at runtime.
  turbopack: {
    resolveAlias: {
      'next-intl/config': './src/i18n.ts',
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BACKEND}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
