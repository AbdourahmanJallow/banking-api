import { Response } from 'express';

export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    meta?: Record<string, unknown>;
    error?: { code: string; message: string };
}

export function sendSuccess<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200,
    meta?: Record<string, unknown>,
): Response {
    const body: ApiResponse<T> = { success: true, data };
    if (message) body.message = message;
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
}

export function sendCreated<T>(
    res: Response,
    data: T,
    message?: string,
): Response {
    return sendSuccess(res, data, message, 201);
}

export function sendNoContent(res: Response): Response {
    return res.status(204).send();
}

export function sendPaginated<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string,
): Response {
    return sendSuccess(res, data, message, 200, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
}
