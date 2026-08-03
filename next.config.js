/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', '@vercel/blob'],
  outputFileTracingIncludes: {
    '/api/materials': ['./node_modules/@napi-rs/canvas*/**/*', './node_modules/pdfjs-dist/legacy/build/**/*', './node_modules/undici/**/*'],
    '/api/materials/upload': ['./node_modules/@vercel/blob*/**/*', './node_modules/undici/**/*'],
    '/api/lipro-ai/chat': ['./node_modules/@napi-rs/canvas*/**/*', './node_modules/pdfjs-dist/legacy/build/**/*', './node_modules/undici/**/*'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'files.lipro.academy' }],
  },
};
module.exports = nextConfig;
