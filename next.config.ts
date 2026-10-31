import type { NextConfig } from 'next';

const config: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { cpus: 2 },
};

export default config;
