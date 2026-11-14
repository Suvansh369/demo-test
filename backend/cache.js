/**
 * In-Memory Freshness-Aware TTL Cache for NIRVAIR.
 * Prevents redundant external network and AI calls while preserving data provenance and freshness.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return {
      value: JSON.parse(JSON.stringify(item.value)),
      cachedAt: item.cachedAt,
      ageSeconds: Math.round((Date.now() - item.cachedAt) / 1000)
    };
  }

  set(key, value, ttlSeconds = 600) {
    // Auto-prune if map grows beyond 1000 items
    if (this.store.size > 1000) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value: JSON.parse(JSON.stringify(value)),
      cachedAt: Date.now(),
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const cache = new MemoryCache();

module.exports = cache;
