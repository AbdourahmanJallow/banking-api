import express, { Request, Response, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import apiRouter from './routes';
import { config } from './config';
import { logger } from './middleware/logger';
import limiter from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
    const app = express();

    // Trust proxy (for rate limiting behind reverse proxy)
    app.set('trust proxy', 1);

    app.use(helmet());

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

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(logger);

    // const limiter = rateLimit({
    //     windowMs: config.rateLimit.windowMs,
    //     max: config.rateLimit.max,
    //     standardHeaders: true,
    //     legacyHeaders: false,
    //     skip: (req) => req.path === '/health',
    //     message: {
    //         success: false,
    //         error: {
    //             code: 'RATE_LIMITED',
    //             message: 'Too many requests, please try again later',
    //         },
    //     },
    // });
    app.use(limiter);

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.use('/api/v1', apiRouter);

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
