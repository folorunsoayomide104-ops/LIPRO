import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://liproacademyapp.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/terms', '/privacy'],
        disallow: ['/api/', '/dashboard', '/admin', '/courses', '/notes', '/flashcards', '/cbt', '/lipro-ai', '/wallet', '/settings', '/notifications', '/login', '/register', '/forgot-password', '/reset-password'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
