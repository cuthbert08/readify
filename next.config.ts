
// next.config.ts
import type { NextConfig } from 'next';
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

const nextConfig: NextConfig = {
  // ... existing config ...
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
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'fluent-ffmpeg': false,
        '@ffmpeg-installer/ffmpeg': false,
        '@ffprobe-installer/ffprobe': false,
      };
    }

    if (isServer) {
      if (!config.externals) {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push('fluent-ffmpeg', '@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe');
      }

      // Add a plugin to copy the binaries to a known location in the build output
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/@ffmpeg-installer/ffmpeg/lib/ffmpeg'),
              to: path.join(__dirname, '.next/server/static/bin/ffmpeg'),
              toType: 'file',
            },
            {
              from: path.join(__dirname, 'node_modules/@ffprobe-installer/ffprobe/lib/ffprobe'),
              to: path.join(__dirname, '.next/server/static/bin/ffprobe'),
              toType: 'file',
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;
