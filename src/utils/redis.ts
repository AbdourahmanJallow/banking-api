import { createClient, RedisClientType } from 'redis';

type RedisClient = RedisClientType<any, any, any>;

const TOKEN_BLACKLIST_PREFIX = 'blacklist:';
const REFRESH_TOKEN_PREFIX = 'refresh:';

class RedisService {
    private client: RedisClient | null = null;
    private isConnected = false;

    // ── Connection ─────────────────────────────────────────────────────────

    async connect(url: string): Promise<void> {
        if (this.isConnected) return;

        this.client = createClient({ url }) as RedisClient;

        this.client.on('error', (err) =>
            console.error('[Redis] Client error:', err),
        );
        this.client.on('connect', () =>
            console.log('🔴 Redis connected successfully'),
        );
        this.client.on('disconnect', () =>
            console.warn('[Redis] Disconnected'),
        );

        await this.client.connect();
        this.isConnected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.client || !this.isConnected) return;
        await this.client.quit();
        this.isConnected = false;
        console.log('[Redis] Disconnected gracefully');
    }

    private ensureConnected(): RedisClient {
        if (!this.client || !this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return this.client;
    }

    // ── Generic key/value ──────────────────────────────────────────────────

    async get(key: string): Promise<string | null> {
        return this.ensureConnected().get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const client = this.ensureConnected();
        if (ttlSeconds) {
            await client.set(key, value, { EX: ttlSeconds });
        } else {
            await client.set(key, value);
        }
    }

    /**
     * Atomically sets a key only if it does not already exist (SET NX EX).
     * Returns true if the key was set, false if it already existed.
     * Used for distributed locking.
     */
    async setNX(
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<boolean> {
        const client = this.ensureConnected();
        const result = await client.set(key, value, {
            NX: true,
            EX: ttlSeconds,
        });
        return result === 'OK';
    }

    async del(key: string): Promise<void> {
        await this.ensureConnected().del(key);
    }

    async exists(key: string): Promise<boolean> {
        const count = await this.ensureConnected().exists(key);
        return count > 0;
    }

    async ttl(key: string): Promise<number> {
        return this.ensureConnected().ttl(key);
    }

    async setJSON<T>(
        key: string,
        value: T,
        ttlSeconds?: number,
    ): Promise<void> {
        await this.set(key, JSON.stringify(value), ttlSeconds);
    }

    async getJSON<T>(key: string): Promise<T | null> {
        const raw = await this.get(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    // ── Token blacklisting ─────────────────────────────────────────────────

    /**
     * Adds an access token to the blacklist.
     * TTL should match the token's remaining lifetime so Redis auto-cleans it.
     */
    async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
        await this.set(`${TOKEN_BLACKLIST_PREFIX}${token}`, '1', ttlSeconds);
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        return this.exists(`${TOKEN_BLACKLIST_PREFIX}${token}`);
    }

    // ── Refresh token store ────────────────────────────────────────────────

    /**
     * Stores a refresh token bound to a userId so it can be revoked on logout.
     */
    async storeRefreshToken(
        userId: string,
        token: string,
        ttlSeconds: number,
    ): Promise<void> {
        await this.set(`${REFRESH_TOKEN_PREFIX}${userId}`, token, ttlSeconds);
    }

    async getRefreshToken(userId: string): Promise<string | null> {
        return this.get(`${REFRESH_TOKEN_PREFIX}${userId}`);
    }

    async revokeRefreshToken(userId: string): Promise<void> {
        await this.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
    }

    // ── Rate-limit / counter helpers ───────────────────────────────────────

    async increment(key: string, ttlSeconds?: number): Promise<number> {
        const client = this.ensureConnected();
        const count = await client.incr(key);
        if (count === 1 && ttlSeconds) {
            await client.expire(key, ttlSeconds);
        }
        return count;
    }

    async decrement(key: string): Promise<number> {
        return this.ensureConnected().decr(key);
    }

    // ── Cache helpers ──────────────────────────────────────────────────────

    async getOrSet<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlSeconds: number,
    ): Promise<T> {
        const cached = await this.getJSON<T>(key);
        if (cached !== null) return cached;

        const fresh = await fetcher();
        await this.setJSON(key, fresh, ttlSeconds);
        return fresh;
    }

    async invalidatePattern(pattern: string): Promise<void> {
        const client = this.ensureConnected();

        let cursor = '0';
        do {
            const result = await client.scan(cursor, {
                MATCH: pattern,
                COUNT: 100,
            });

            cursor = result.cursor.toString();

            if (result.keys.length > 0) {
                await client.del(result.keys);
            }
        } while (cursor !== '0');
    }

    get connected(): boolean {
        return this.isConnected;
    }
}

// Singleton instance
const redisService = new RedisService();
export default redisService;
