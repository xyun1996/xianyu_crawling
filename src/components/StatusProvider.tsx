'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CrawlStatus } from '@/lib/types';

const StatusContext = createContext<CrawlStatus | null>(null);
const RefreshContext = createContext<() => void>(() => {});

export function useCrawlStatus() {
  return useContext(StatusContext);
}

export function useRefreshStatus() {
  return useContext(RefreshContext);
}

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CrawlStatus | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/crawl/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Network error, skip this poll
    }
  }, []);

  useEffect(() => {
    poll(); // Initial fetch
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <StatusContext.Provider value={status}>
      <RefreshContext.Provider value={poll}>
        {children}
      </RefreshContext.Provider>
    </StatusContext.Provider>
  );
}
