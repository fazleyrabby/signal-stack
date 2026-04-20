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

  // 🔥 Proper CDN caching (Cloudflare-compatible)
  async headers() {
    return [
      // ✅ Cache all frontend pages
      {
        source: '/((?!api|_next|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=7200, stale-while-revalidate=86400',
          },
        ],
      },

      // ❌ Never cache API routes
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