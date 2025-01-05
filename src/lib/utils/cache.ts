interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export class Cache<T> {
  private store = new Map<string, CacheItem<T>>();
  private ttl: number;

  constructor(ttlMinutes: number = 60) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.store.clear();
  }
} 