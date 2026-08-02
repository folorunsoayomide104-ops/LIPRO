/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'files.lipro.academy' }],
  },
};
module.exports = nextConfig;
