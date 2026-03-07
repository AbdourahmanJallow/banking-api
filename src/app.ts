import express, { Request, Response, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import apiRouter from './routes';

export function createApp(): Express {
    const app = express();

    // Trust proxy (for rate limiting behind reverse proxy)
    app.set('trust proxy', 1);

    // Security headers
    app.use(helmet());

    // CORS
    app.use(
        cors({
            origin: config.frontendUrl,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Organization-Id',
            ],
        }),
    );

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logger
    app.use(logger);

    // Rate limiting
    const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health',
        message: {
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests, please try again later',
            },
        },
    });
    app.use(limiter);

    // ── Health check ────────────────────────────────────────────────────────
    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ── API routes ───────────────────────────────────────────────────────────
    app.use('/api', apiRouter);

    // ── 404 ─────────────────────────────────────────────────────────────────
    app.use((_req: Request, res: Response) => {
        res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Route not found' },
        });
    });

    // ── Global error handler (must be last) ──────────────────────────────────
    app.use(errorHandler);

    return app;
}
