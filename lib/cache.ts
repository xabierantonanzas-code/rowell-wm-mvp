/**
 * Simple in-memory cache with TTL for server-side queries.
 * Survives within a single serverless invocation but resets on cold starts.
 * For production, replace with Redis/Vercel KV.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const store = new Map<string, CacheEntry<any>>();

/**
 * Get or compute a cached value.
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param compute - Async function to compute the value if not cached
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);

  if (existing && existing.expiry > now) {
    return existing.data as T;
  }

  const data = await compute();
  store.set(key, { data, expiry: now + ttlSeconds * 1000 });

  // Cleanup old entries if store gets large
  if (store.size > 500) {
    store.forEach((entry, k) => {
      if (entry.expiry < now) store.delete(k);
    });
  }

  return data;
}

/**
 * Invalidate a cache entry or all entries matching a prefix.
 */
export function invalidateCache(keyOrPrefix: string) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Prefix match
  store.forEach((_, k) => {
    if (k.startsWith(keyOrPrefix)) store.delete(k);
  });
}
