interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5000;
const LONG_TTL = 60000;

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheInvalidate(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  const prefix = pattern.endsWith(':') ? pattern : `${pattern}:`;
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function cached<T>(key: string, fn: () => T, ttl: number = DEFAULT_TTL): T {
  const result = cacheGet<T>(key);
  if (result !== null) return result;
  const value = fn();
  cacheSet(key, value, ttl);
  return value;
}

export { DEFAULT_TTL, LONG_TTL };