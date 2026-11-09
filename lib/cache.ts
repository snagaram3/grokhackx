/** Tape cache TTL. Distinct from GDELT 10min world cache and hourly LOOKUP_MS 25s. */
export const TTL_MS = 15 * 60 * 1000;

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key) as Entry<T> | undefined;
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    return undefined;
  }
  return hit.value;
}

export function cacheSet<T>(key: string, value: T): void {
  store.set(key, { value, expires: Date.now() + TTL_MS });
}

export function cachePeek<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}
