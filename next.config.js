/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['pdf-parse'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'files.lipro.academy' }],
  },
};
module.exports = nextConfig;
