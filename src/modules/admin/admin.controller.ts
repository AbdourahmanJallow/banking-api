import { Request, Response } from 'express';
import * as AdminService from './admin.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { z } from 'zod';

export const getDashboard = asyncHandler(
    async (_req: Request, res: Response) => {
        const stats = await AdminService.getDashboardStats();
        sendSuccess(res, stats);
    },
);

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { users, total } = await AdminService.listAllUsers(page, limit);
    sendPaginated(res, users, total, page, limit);
});

export const setUserStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = z
            .object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) })
            .parse(req.body);
        const user = await AdminService.setUserStatus(
            req.params.userId,
            status,
        );
        sendSuccess(res, user, 'User status updated');
    },
);

export const getAuditLogs = asyncHandler(
    async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const { logs, total } = await AdminService.getAuditLogs(page, limit);
        sendPaginated(res, logs, total, page, limit);
    },
);
