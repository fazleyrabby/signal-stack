import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const API_BACKEND = process.env.API_BACKEND_URL || 'http://localhost:3000';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
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
