/**
 * Structured application error that carries an HTTP status code and
 * an optional machine-readable code understood by the error handler.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }

    // ── convenience factories ──────────────────────────────────────────────

    static badRequest(message: string, code = 'BAD_REQUEST') {
        return new AppError(message, 400, code);
    }

    static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        return new AppError(message, 401, code);
    }

    static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
        return new AppError(message, 403, code);
    }

    static notFound(message: string, code = 'NOT_FOUND') {
        return new AppError(message, 404, code);
    }

    static conflict(message: string, code = 'CONFLICT') {
        return new AppError(message, 409, code);
    }

    static unprocessable(message: string, code = 'UNPROCESSABLE') {
        return new AppError(message, 422, code);
    }

    static internal(message = 'Internal Server Error') {
        return new AppError(message, 500, 'INTERNAL_ERROR');
    }
}
