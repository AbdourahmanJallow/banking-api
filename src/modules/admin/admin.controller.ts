import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { z } from 'zod';
// Audit log queries are handled by the dedicated /api/v1/audit routes.

export const getDashboard = asyncHandler(
    async (_req: Request, res: Response) => {
        const stats = await adminService.getDashboardStats();
        sendSuccess(res, stats);
    },
);

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;

    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const { users, total } = await adminService.listAllUsers(page, limit);

    sendPaginated(res, users, total, page, limit);
});

export const setUserStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = z
            .object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) })
            .parse(req.body);

        const user = await adminService.setUserStatus(
            req.params.userId as string,
            status,
        );

        sendSuccess(res, user, 'User status updated');
    },
);
