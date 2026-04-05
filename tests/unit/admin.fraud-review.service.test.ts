import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
    default: {
        transaction: {
            findUnique: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn(),
        user: {
            count: vi.fn(),
            findMany: vi.fn(),
            groupBy: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        account: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        auditLogModel: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        $queryRaw: vi.fn(),
    },
}));

vi.mock('../../src/config/redis', () => ({
    redisService: {
        connected: true,
    },
}));

vi.mock('../../src/modules/accounts/account.repository', () => ({
    accountRepository: {
        updateAllByUserId: vi.fn(),
    },
}));

import prisma from '../../src/lib/prisma';
import { adminService } from '../../src/modules/admin/admin.service';

describe('adminService fraud review actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists flagged transactions with pagination metadata', async () => {
        const mockTransactions = [
            {
                id: 'tx-1',
                reference: 'TXN-001',
                riskScore: 80,
                isFlagged: true,
                fraudReviewStatus: 'PENDING_REVIEW',
            },
        ];

        vi.mocked(prisma.$transaction).mockResolvedValue([
            mockTransactions,
            1,
        ] as any);

        const result = await adminService.listFlaggedTransactions(1, 20);

        expect(result.transactions).toEqual(mockTransactions);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
    });

    it('rejects review when transaction does not exist', async () => {
        vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null as any);

        await expect(
            adminService.reviewFlaggedTransaction({
                transactionId: 'missing-tx',
                action: 'APPROVE',
                reviewerId: 'admin-1',
            }),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rejects review when transaction is not flagged', async () => {
        vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
            id: 'tx-1',
            isFlagged: false,
            fraudReviewStatus: 'PENDING_REVIEW',
            reference: 'TXN-001',
            riskScore: 45,
        } as any);

        await expect(
            adminService.reviewFlaggedTransaction({
                transactionId: 'tx-1',
                action: 'APPROVE',
                reviewerId: 'admin-1',
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects review when already decided', async () => {
        vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
            id: 'tx-1',
            isFlagged: true,
            fraudReviewStatus: 'APPROVED',
            reference: 'TXN-001',
            riskScore: 88,
        } as any);

        await expect(
            adminService.reviewFlaggedTransaction({
                transactionId: 'tx-1',
                action: 'REJECT',
                reviewerId: 'admin-1',
            }),
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('approves a flagged transaction and writes an audit log', async () => {
        vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
            id: 'tx-1',
            isFlagged: true,
            fraudReviewStatus: 'PENDING_REVIEW',
            reference: 'TXN-001',
            riskScore: 90,
        } as any);

        vi.mocked(prisma.transaction.update).mockResolvedValue({
            id: 'tx-1',
            reference: 'TXN-001',
            status: 'COMPLETED',
            riskScore: 90,
            riskLevel: 'HIGH',
            isFlagged: true,
            fraudReviewStatus: 'APPROVED',
            fraudReviewNote: 'Legitimate large transfer',
            fraudReviewedBy: 'admin-1',
            fraudReviewedAt: new Date('2026-04-04T12:00:00Z'),
        } as any);

        const result = await adminService.reviewFlaggedTransaction({
            transactionId: 'tx-1',
            action: 'APPROVE',
            reviewerId: 'admin-1',
            note: 'Legitimate large transfer',
        });

        expect(prisma.transaction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'tx-1' },
                data: expect.objectContaining({
                    fraudReviewStatus: 'APPROVED',
                    fraudReviewNote: 'Legitimate large transfer',
                    fraudReviewedBy: 'admin-1',
                }),
            }),
        );
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'admin-1',
                    action: 'FRAUD_REVIEW.APPROVED',
                    resource: 'TRANSACTION',
                    resourceId: 'tx-1',
                }),
            }),
        );
        expect(result.fraudReviewStatus).toBe('APPROVED');
    });
});
