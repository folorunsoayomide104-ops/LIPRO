'use client';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

/**
 * Tracks the `dark` class on <html> directly rather than next-themes'
 * useTheme() — ThemeToggle.tsx flips that class (and its own localStorage
 * key) by hand instead of calling next-themes' setTheme(), so useTheme()'s
 * state can drift from what's actually applied to the page.
 */
export function AppToaster() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <Toaster theme={isDark ? 'dark' : 'light'} richColors position="top-center" />;
}
