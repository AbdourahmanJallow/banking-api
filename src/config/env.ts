import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    // Environment
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    // Server
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis (optional for local dev)
    REDIS_URL: z.string().url().optional(),

    // JWT
    JWT_SECRET: z
        .string()
        .min(32)
        .default('dev-secret-key-change-this-in-production!!'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // Encryption
    ENCRYPTION_KEY: z
        .string()
        .min(32)
        .default('dev-encryption-key-change-this!!'),

    // Secrets Encryption (defaults to ENCRYPTION_KEY if not set)
    SECRETS_ENCRYPTION_KEY: z.string().min(32).optional(),

    // Email (optional for local dev)
    RESEND_API_KEY: z.string().optional(),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(100),

    // Logging
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),

    // Frontend URL
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    // App URL
    APP_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.format());
        process.exit(1);
    }

    return result.data;
}

export const env = loadEnv();

export const config = {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',

    server: {
        port: env.PORT,
        host: env.HOST,
    },

    db: {
        url: env.DATABASE_URL,
    },

    redis: {
        url: env.REDIS_URL ?? '',
    },

    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },

    encryption: {
        key: env.ENCRYPTION_KEY,
        secretsKey: env.SECRETS_ENCRYPTION_KEY ?? env.ENCRYPTION_KEY,
    },

    email: {
        apiKey: env.RESEND_API_KEY ?? '',
    },

    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
    },

    logging: {
        level: env.LOG_LEVEL,
    },

    frontendUrl: env.FRONTEND_URL,
    appUrl: env.APP_URL,
} as const;
