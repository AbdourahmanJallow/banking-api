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
}

/**
 * 400 Bad Request - The request is malformed or contains invalid data
 */
export class BadRequestError extends AppError {
    constructor(message: string, code = 'BAD_REQUEST') {
        super(message, 400, code);
        this.name = 'BadRequestError';
    }
}

/**
 * 401 Unauthorized - Authentication is missing or invalid
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(message, 401, code);
        this.name = 'UnauthorizedError';
    }
}

/**
 * 403 Forbidden - Authentication is valid but user lacks permission
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(message, 403, code);
        this.name = 'ForbiddenError';
    }
}

/**
 * 404 Not Found - The requested resource does not exist
 */
export class NotFoundError extends AppError {
    constructor(message: string, code = 'NOT_FOUND') {
        super(message, 404, code);
        this.name = 'NotFoundError';
    }
}

/**
 * 409 Conflict - The request conflicts with the current state
 */
export class ConflictError extends AppError {
    constructor(message: string, code = 'CONFLICT') {
        super(message, 409, code);
        this.name = 'ConflictError';
    }
}

/**
 * 422 Unprocessable Entity - The request is well-formed but semantically invalid
 */
export class UnprocessableError extends AppError {
    constructor(message: string, code = 'UNPROCESSABLE') {
        super(message, 422, code);
        this.name = 'UnprocessableError';
    }
}

/**
 * 500 Internal Server Error - An unexpected server error occurred
 */
export class InternalError extends AppError {
    constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
        super(message, 500, code);
        this.name = 'InternalError';
    }
}
