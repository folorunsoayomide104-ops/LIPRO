/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // pdfjs-dist added alongside the others — its legacy Node build does its
  // own internal require('@napi-rs/canvas') for page rendering (confirmed
  // directly against a live Vercel deployment: "Cannot find module
  // '@napi-rs/canvas'" thrown from inside pdfjs-dist/legacy/build/pdf.mjs).
  // Marking it external too keeps that require resolving through Node's
  // normal runtime module resolution instead of the bundler trying to
  // statically trace a dynamic require inside a third-party package.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', '@vercel/blob', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    // Broadened from '@napi-rs/canvas*' to '@napi-rs/**' — the native
    // binary actually lives in a separate per-platform package
    // (@napi-rs/canvas-<platform>, confirmed locally), not inside
    // @napi-rs/canvas itself, and the narrower glob risked missing it.
    '/api/materials': ['./node_modules/@napi-rs/**/*', './node_modules/pdfjs-dist/**/*', './node_modules/undici/**/*'],
    '/api/materials/[id]/questions': ['./node_modules/@napi-rs/**/*', './node_modules/pdfjs-dist/**/*', './node_modules/undici/**/*'],
    '/api/materials/upload': ['./node_modules/@vercel/blob*/**/*', './node_modules/undici/**/*'],
    '/api/lipro-ai/chat': ['./node_modules/@napi-rs/**/*', './node_modules/pdfjs-dist/**/*', './node_modules/undici/**/*'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'files.lipro.academy' }],
  },
  async rewrites() {
    return [
      { source: '/help-center', destination: '/help-center.html' },
      { source: '/documentation', destination: '/documentation.html' },
      { source: '/support', destination: '/support.html' },
      { source: '/cookie-policy', destination: '/cookie-policy.html' },
    ];
  },
};
module.exports = nextConfig;
