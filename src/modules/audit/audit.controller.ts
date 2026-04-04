import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { AuditLogQuerySchema } from './audit.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import {
    UnauthorizedError,
    BadRequestError,
    NotFoundError,
} from '../../utils/AppError';

/** GET /api/v1/audit/logs
 *  Query params: userId, action, resource, statusCode, from, to, page, limit
 */
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = AuditLogQuerySchema.parse(req.query);

    const { logs, total, page, limit } = await auditService.getLogs(query);

    sendPaginated(res, logs, total, page, limit);
});

/** GET /api/v1/audit/logs/:id */
export const getLog = asyncHandler(async (req: Request, res: Response) => {
    const log = await auditService.getLog(req.params.id as string);

    if (!log) throw new NotFoundError('Audit log entry not found');

    sendSuccess(res, log);
});

/** GET /api/v1/audit/users/:userId/logs */
export const getUserLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const { logs, total } = await auditService.getUserLogs(
        req.params.userId as string,
        page,
        limit,
    );

    sendPaginated(res, logs, total, page, limit);
});
