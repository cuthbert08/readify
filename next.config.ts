// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // For the client-side build, tell Webpack to ignore these modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'fluent-ffmpeg': false,
        '@ffmpeg-installer/ffmpeg': false,
      };
    }

    // For the server-side build, tell Webpack to treat these as external dependencies
    if (isServer) {
      if (config.externals) {
        if (Array.isArray(config.externals)) {
          config.externals.push('fluent-ffmpeg', '@ffmpeg-installer/ffmpeg');
        } else {
          // This case handles a non-array externals configuration, though less common.
          config.externals = ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'];
        }
      } else {
        config.externals = ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'];
      }
    }

    return config;
  },
};

export default nextConfig;