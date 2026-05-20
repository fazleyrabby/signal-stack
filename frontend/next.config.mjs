import createNextIntlPlugin from 'next-intl/plugin';

const API_BACKEND = process.env.API_BACKEND_URL || 'http://localhost:3000';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix for next-intl with Turbopack
  turbopack: {
    resolveAlias: {
      'next-intl/config': './src/i18n.ts',
    },
  },

  // Proxy API to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BACKEND}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      // HTML pages: never edge-cache (Cloudflare Tunnel). Old HTML referencing stale CSS hashes breaks styles.
      {
        source: '/((?!api|_next|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },

      // Static assets with content hashes are immutable — cache forever
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // API routes: no cache
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);