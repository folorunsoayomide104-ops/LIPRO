'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ViewMode = 'desktop' | 'mobile';
const KEY = 'lipro-view-mode';

const ViewModeCtx = createContext<{ viewMode: ViewMode; setViewMode: (m: ViewMode) => void }>({
  viewMode: 'desktop',
  setViewMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('desktop');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'mobile') setViewModeState('mobile');
    } catch { /* noop */ }
  }, []);

  const setViewMode = (m: ViewMode) => {
    setViewModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* noop */ }
  };

  return (
    <ViewModeCtx.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeCtx.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeCtx);
}
