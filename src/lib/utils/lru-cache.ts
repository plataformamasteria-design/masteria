/**
 * Simple LRU (Least Recently Used) Cache implementation
 * for memory-constrained environments
 */
export class LRUCache<K, V> {
    private cache: Map<K, { value: V; timestamp: number }>;
    private maxSize: number;
    private ttl: number; // Time to live in milliseconds

    constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) { // Default 5 minutes
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: K): V | undefined {
        const item = this.cache.get(key);

        if (!item) {
            return undefined;
        }

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, { value: item.value, timestamp: Date.now() });

        return item.value;
    }

    set(key: K, value: V): void {
        // Remove if exists (will be re-added at end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, { value, timestamp: Date.now() });
    }

    has(key: K): boolean {
        const item = this.cache.get(key);

        if (!item) {
            return false;
        }

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        // Clean expired entries first
        this.cleanExpired();
        return this.cache.size;
    }

    keys(): K[] {
        this.cleanExpired();
        const allKeys: K[] = [];
        for (const key of this.cache.keys()) {
            allKeys.push(key);
        }
        return allKeys;
    }

    private cleanExpired(): void {
        const now = Date.now();
        const keysToDelete: K[] = [];

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Get stats about cache usage (for debugging)
     */
    getStats() {
        this.cleanExpired();
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            utilization: ((this.cache.size / this.maxSize) * 100).toFixed(2) + '%',
        };
    }
}
