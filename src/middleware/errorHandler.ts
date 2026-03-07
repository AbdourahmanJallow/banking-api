import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Known operational error
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: { code: err.code, message: err.message },
        });
        return;
    }

    // Zod validation error
    if (err instanceof ZodError) {
        res.status(422).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: err.flatten().fieldErrors,
            },
        });
        return;
    }

    // Prisma unique constraint
    if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
    ) {
        res.status(409).json({
            success: false,
            error: { code: 'CONFLICT', message: 'Resource already exists' },
        });
        return;
    }

    // Unknown error
    const message =
        process.env.NODE_ENV === 'production'
            ? 'Something went wrong'
            : ((err as Error)?.message ?? 'Internal Server Error');

    console.error('[Unhandled Error]', err);

    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
    });
}
