/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  turbopack: {
    root: __dirname,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;
