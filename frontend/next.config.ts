import type { NextConfig } from "next";

const API_BACKEND = process.env.API_BACKEND_URL || 'http://127.0.0.1:3000';

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

export default nextConfig;
