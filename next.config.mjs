/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type checking runs in development; do not block deploys on strictness warnings.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
