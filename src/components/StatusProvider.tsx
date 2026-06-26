'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { CrawlStatus } from '@/lib/types';

const StatusContext = createContext<CrawlStatus | null>(null);
const RefreshContext = createContext<() => void>(() => {});

export function useCrawlStatus() {
  return useContext(StatusContext);
}

export function useRefreshStatus() {
  return useContext(RefreshContext);
}

const IDLE_INTERVAL = 30000;   // 30s when idle
const ACTIVE_INTERVAL = 3000;  // 3s when crawling

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CrawlStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Dynamic polling: fast when crawling, slow when idle
  useEffect(() => {
    poll(); // Initial fetch

    const isActive = status?.running && !status?.paused;
    const interval = isActive ? ACTIVE_INTERVAL : IDLE_INTERVAL;

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status?.running, status?.paused, poll]);

  return (
    <StatusContext.Provider value={status}>
      <RefreshContext.Provider value={poll}>
        {children}
      </RefreshContext.Provider>
    </StatusContext.Provider>
  );
}
