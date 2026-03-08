import redisService from '../utils/redis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export async function connectRedis(): Promise<void> {
    try {
        await redisService.connect(REDIS_URL);
    } catch (error) {
        // Redis is optional in development — log and continue
        console.warn(
            '[Redis] Could not connect, token blacklisting disabled:',
            error,
        );
    }
}

export async function disconnectRedis(): Promise<void> {
    await redisService.disconnect();
}

export { redisService };
