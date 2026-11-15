// Lightweight in-memory cache so navigating back to a page doesn't
// flash a loading spinner while data is re-fetched.
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCached(key: string): void {
  store.delete(key);
}

export function clearCachePrefix(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
