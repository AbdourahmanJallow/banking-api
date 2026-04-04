import redisService from './redis';
import { AppError, ConflictError } from './AppError';

const IDEMPOTENCY_PREFIX = 'idempotency:';
const LOCK_PREFIX = 'idempotency:lock:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const LOCK_TTL_SECONDS = 30; // processing lock lifetime

export interface IdempotencyResult<T> {
    data: T;
    statusCode: number;
    replayed: boolean;
}

interface StoredRecord<T> {
    statusCode: number;
    data: T;
    createdAt: string;
}

/**
 * Idempotency guarantees for mutating operations.
 *
 * How it works:
 *   1. Client sends a unique `idempotencyKey` (e.g. UUID v4) with the request.
 *   2. On the first call the operation executes normally; the result is stored
 *      in Redis under `idempotency:{userId}:{key}` with a 24-hour TTL.
 *   3. On any subsequent call with the same key the cached result is returned
 *      immediately — the operation is NOT re-executed.
 *   4. A short-lived distributed lock (`idempotency:lock:{userId}:{key}`) is
 *      held while the operation runs so two simultaneous identical requests
 *      cannot both execute; the second receives a 409 while the first is in
 *      flight.
 *   5. When Redis is unavailable the service degrades gracefully: the
 *      operation runs without idempotency caching.
 *
 * The key is always scoped to the requesting user so one user cannot
 * replay or observe another user's transactions.
 */
class IdempotencyService {
    private resultKey(userId: string, idempotencyKey: string): string {
        return `${IDEMPOTENCY_PREFIX}${userId}:${idempotencyKey}`;
    }

    private lockKey(userId: string, idempotencyKey: string): string {
        return `${LOCK_PREFIX}${userId}:${idempotencyKey}`;
    }

    async execute<T>(
        userId: string,
        idempotencyKey: string,
        operation: () => Promise<{ statusCode: number; data: T }>,
        ttlSeconds = DEFAULT_TTL_SECONDS,
    ): Promise<IdempotencyResult<T>> {
        // Graceful degradation when Redis is unavailable
        if (!redisService.connected) {
            const result = await operation();
            return { ...result, replayed: false };
        }

        const resultKey = this.resultKey(userId, idempotencyKey);
        const lockKey = this.lockKey(userId, idempotencyKey);

        // Fast path: result already cached
        const cached = await redisService.getJSON<StoredRecord<T>>(resultKey);
        if (cached) {
            return {
                data: cached.data,
                statusCode: cached.statusCode,
                replayed: true,
            };
        }

        // Acquire distributed lock (SET NX EX)
        const lockAcquired = await redisService.setNX(
            lockKey,
            '1',
            LOCK_TTL_SECONDS,
        );

        if (!lockAcquired) {
            // Another request with this key is already in-flight
            throw new ConflictError(
                'A request with this idempotency key is currently being processed. ' +
                    'Please wait a moment and retry.',
                'IDEMPOTENCY_PROCESSING',
            );
        }

        try {
            // Double-check after acquiring the lock — another process may have
            // completed between our first check and acquiring the lock
            const cachedAfterLock =
                await redisService.getJSON<StoredRecord<T>>(resultKey);
            if (cachedAfterLock) {
                return {
                    data: cachedAfterLock.data,
                    statusCode: cachedAfterLock.statusCode,
                    replayed: true,
                };
            }

            // Execute the real operation
            const result = await operation();

            // Persist the result for future replays
            const record: StoredRecord<T> = {
                statusCode: result.statusCode,
                data: result.data,
                createdAt: new Date().toISOString(),
            };
            await redisService.setJSON(resultKey, record, ttlSeconds);

            return {
                data: result.data,
                statusCode: result.statusCode,
                replayed: false,
            };
        } finally {
            // Always release the lock — even if the operation threw
            await redisService.del(lockKey);
        }
    }
}

export const idempotencyService = new IdempotencyService();
