"use client";
import { useEffect, useState, useCallback } from 'react';
import { clearExpiredCache, getCacheStats, clearAllCache } from '@/lib/apiCache';

export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(true);
  const [swRegistered, setSwRegistered] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ totalEntries: number; totalSize: number } | null>(null);

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Set initial online status
    setIsOnline(navigator.onLine);

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[Offline] Service worker registered');
        setSwRegistered(true);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Every hour
      })
      .catch((error) => {
        console.warn('[Offline] Service worker registration failed:', error);
      });

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Offline] Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Offline] Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Clear expired cache on startup
    clearExpiredCache();

    // Update cache stats
    getCacheStats().then(setCacheStats);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh cache stats
  const refreshCacheStats = useCallback(async () => {
    const stats = await getCacheStats();
    setCacheStats(stats);
    return stats;
  }, []);

  // Clear all caches
  const clearCache = useCallback(async () => {
    await clearAllCache();
    
    // Also clear service worker cache
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    
    await refreshCacheStats();
  }, [refreshCacheStats]);

  return {
    isOnline,
    swRegistered,
    cacheStats,
    refreshCacheStats,
    clearCache,
  };
}
