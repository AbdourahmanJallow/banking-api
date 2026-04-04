import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { UnauthorizedError } from '../../utils/AppError';
import { z } from 'zod';

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

export const getTransactions = asyncHandler(
    async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 50, 200);

        const status = req.query.status as string | undefined;
        const type = req.query.type as string | undefined;
        const flagged =
            req.query.flagged !== undefined
                ? String(req.query.flagged).toLowerCase() === 'true'
                : undefined;
        const fraudReviewStatus = req.query.fraudReviewStatus as
            | string
            | undefined;

        const minAmount = req.query.minAmount
            ? Number(req.query.minAmount)
            : undefined;
        const maxAmount = req.query.maxAmount
            ? Number(req.query.maxAmount)
            : undefined;

        const startDate = req.query.startDate
            ? new Date(req.query.startDate as string)
            : undefined;
        const endDate = req.query.endDate
            ? new Date(req.query.endDate as string)
            : undefined;

        const { transactions, total } =
            await adminService.getTransactionMonitoring({
                page,
                limit,
                status,
                type,
                flagged,
                fraudReviewStatus,
                minAmount,
                maxAmount,
                startDate,
                endDate,
            });

        sendPaginated(res, transactions, total, page, limit);
    },
);

export const getFlaggedTransactions = asyncHandler(
    async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 50, 200);

        const { transactions, total } =
            await adminService.listFlaggedTransactions(page, limit);

        sendPaginated(res, transactions, total, page, limit);
    },
);

export const reviewFlaggedTransaction = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) {
            throw new UnauthorizedError();
        }

        const { action, note } = z
            .object({
                action: z.enum(['APPROVE', 'REJECT']),
                note: z.string().max(500).optional(),
            })
            .parse(req.body);

        const result = await adminService.reviewFlaggedTransaction({
            transactionId: req.params.transactionId as string,
            action,
            note,
            reviewerId: req.user.userId,
        });

        sendSuccess(res, result, 'Fraud review decision recorded');
    },
);

export const getAuditLogs = asyncHandler(
    async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 50, 200);

        const userId = req.query.userId as string | undefined;

        const action = req.query.action as string | undefined;
        const resource = req.query.resource as string | undefined;

        const startDate = req.query.startDate
            ? new Date(req.query.startDate as string)
            : undefined;
        const endDate = req.query.endDate
            ? new Date(req.query.endDate as string)
            : undefined;

        const { logs, total } = await adminService.getAuditLogs({
            page,
            limit,
            userId,
            action,
            resource,
            startDate,
            endDate,
        });

        sendPaginated(res, logs, total, page, limit);
    },
);

export const getUserActivity = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.params.userId as string;

        const timeline = await adminService.getUserActivityTimeline(userId);

        sendSuccess(res, timeline);
    },
);

export const getSystemHealth = asyncHandler(
    async (_req: Request, res: Response) => {
        const health = await adminService.getSystemHealth();

        sendSuccess(res, health);
    },
);

export const getKYCAnalytics = asyncHandler(
    async (_req: Request, res: Response) => {
        const analytics = await adminService.getKYCAnalytics();

        sendSuccess(res, analytics);
    },
);

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
