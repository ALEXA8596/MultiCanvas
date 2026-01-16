import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Cache entry with metadata
export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
  accountDomain: string;
}

interface CacheDB extends DBSchema {
  'api-cache': {
    key: string;
    value: CacheEntry;
    indexes: {
      'by-domain': string;
      'by-expiry': number;
    };
  };
}

const CACHE_DB_NAME = 'multi-canvas-cache';
const CACHE_DB_VERSION = 1;
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

// Default cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  COURSES: 1000 * 60 * 60 * 24, // 24 hours
  MODULES: 1000 * 60 * 60 * 12, // 12 hours
  ASSIGNMENTS: 1000 * 60 * 60 * 6, // 6 hours
  PAGES: 1000 * 60 * 60 * 24, // 24 hours
  ANNOUNCEMENTS: 1000 * 60 * 30, // 30 minutes
  DASHBOARD: 1000 * 60 * 15, // 15 minutes
  GRADES: 1000 * 60 * 30, // 30 minutes
  FILES: 1000 * 60 * 60 * 24, // 24 hours
  PLANNER: 1000 * 60 * 15, // 15 minutes
  DEFAULT: 1000 * 60 * 60, // 1 hour
};

// Determine cache duration based on API path
function getCacheDuration(path: string): number {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes('courses') && !lowerPath.includes('/')) return CACHE_DURATIONS.COURSES;
  if (lowerPath.includes('modules')) return CACHE_DURATIONS.MODULES;
  if (lowerPath.includes('assignments')) return CACHE_DURATIONS.ASSIGNMENTS;
  if (lowerPath.includes('pages')) return CACHE_DURATIONS.PAGES;
  if (lowerPath.includes('announcements')) return CACHE_DURATIONS.ANNOUNCEMENTS;
  if (lowerPath.includes('dashboard')) return CACHE_DURATIONS.DASHBOARD;
  if (lowerPath.includes('grades') || lowerPath.includes('enrollments')) return CACHE_DURATIONS.GRADES;
  if (lowerPath.includes('files')) return CACHE_DURATIONS.FILES;
  if (lowerPath.includes('planner')) return CACHE_DURATIONS.PLANNER;
  return CACHE_DURATIONS.DEFAULT;
}

let cacheDbPromise: Promise<IDBPDatabase<CacheDB>> | null = null;

function getCacheDb(): Promise<IDBPDatabase<CacheDB>> {
  if (!isBrowser) {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  
  if (!cacheDbPromise) {
    cacheDbPromise = openDB<CacheDB>(CACHE_DB_NAME, CACHE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('api-cache')) {
          const store = db.createObjectStore('api-cache', { keyPath: 'key' });
          store.createIndex('by-domain', 'accountDomain');
          store.createIndex('by-expiry', 'expiresAt');
        }
      },
    });
  }
  
  return cacheDbPromise;
}

// Generate cache key from domain and path
export function getCacheKey(domain: string, path: string): string {
  return `${domain}::${path}`;
}

// Get cached data
export async function getCachedData<T>(domain: string, path: string): Promise<T | null> {
  if (!isBrowser) return null;
  
  try {
    const db = await getCacheDb();
    const key = getCacheKey(domain, path);
    const entry = await db.get('api-cache', key);
    
    if (!entry) return null;
    
    // Check if cache is still valid
    if (Date.now() > entry.expiresAt) {
      // Cache expired, but we might still use it if offline
      if (!navigator.onLine) {
        console.log(`[Cache] Using expired cache for ${path} (offline)`);
        return entry.data as T;
      }
      // Online and expired - return null to fetch fresh data
      return null;
    }
    
    return entry.data as T;
  } catch (e) {
    console.warn('[Cache] Error reading cache:', e);
    return null;
  }
}

// Set cached data
export async function setCachedData<T>(
  domain: string, 
  path: string, 
  data: T,
  customDuration?: number
): Promise<void> {
  if (!isBrowser) return;
  
  try {
    const db = await getCacheDb();
    const key = getCacheKey(domain, path);
    const duration = customDuration ?? getCacheDuration(path);
    const now = Date.now();
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      expiresAt: now + duration,
      accountDomain: domain,
    };
    
    await db.put('api-cache', entry);
  } catch (e) {
    console.warn('[Cache] Error writing cache:', e);
  }
}

// Clear cache for a specific domain
export async function clearDomainCache(domain: string): Promise<void> {
  if (!isBrowser) return;
  
  try {
    const db = await getCacheDb();
    const tx = db.transaction('api-cache', 'readwrite');
    const index = tx.store.index('by-domain');
    
    let cursor = await index.openCursor(IDBKeyRange.only(domain));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    
    await tx.done;
  } catch (e) {
    console.warn('[Cache] Error clearing domain cache:', e);
  }
}

// Clear all expired cache entries
export async function clearExpiredCache(): Promise<void> {
  if (!isBrowser) return;
  
  try {
    const db = await getCacheDb();
    const tx = db.transaction('api-cache', 'readwrite');
    const index = tx.store.index('by-expiry');
    const now = Date.now();
    
    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
    let count = 0;
    while (cursor) {
      await cursor.delete();
      count++;
      cursor = await cursor.continue();
    }
    
    await tx.done;
    if (count > 0) {
      console.log(`[Cache] Cleared ${count} expired entries`);
    }
  } catch (e) {
    console.warn('[Cache] Error clearing expired cache:', e);
  }
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  if (!isBrowser) return;
  
  try {
    const db = await getCacheDb();
    await db.clear('api-cache');
    console.log('[Cache] Cleared all cache');
  } catch (e) {
    console.warn('[Cache] Error clearing all cache:', e);
  }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  byDomain: Record<string, number>;
}> {
  if (!isBrowser) return { totalEntries: 0, totalSize: 0, byDomain: {} };
  
  try {
    const db = await getCacheDb();
    const entries = await db.getAll('api-cache');
    
    const byDomain: Record<string, number> = {};
    let totalSize = 0;
    
    entries.forEach(entry => {
      byDomain[entry.accountDomain] = (byDomain[entry.accountDomain] || 0) + 1;
      totalSize += JSON.stringify(entry.data).length;
    });
    
    return {
      totalEntries: entries.length,
      totalSize,
      byDomain,
    };
  } catch (e) {
    console.warn('[Cache] Error getting stats:', e);
    return { totalEntries: 0, totalSize: 0, byDomain: {} };
  }
}

// Check if browser is online
export function isOnline(): boolean {
  if (!isBrowser) return true;
  return navigator.onLine;
}

// Listen to online/offline events
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (!isBrowser) return () => {};
  
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
