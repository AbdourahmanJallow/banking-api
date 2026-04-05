/**
 * Integration tests for admin fraud review routes.
 * Prisma and Redis are mocked so no real DB/cache is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            findMany: vi.fn(),
            groupBy: vi.fn(),
        },
        account: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        transaction: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            aggregate: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        $transaction: vi.fn(),
        $connect: vi.fn(),
        $queryRaw: vi.fn(),
        $disconnect: vi.fn(),
    },
}));

vi.mock('../../src/config/redis', () => ({
    redisService: {
        connected: false,
        blacklistToken: vi.fn(),
        isTokenBlacklisted: vi.fn().mockResolvedValue(false),
        storeRefreshToken: vi.fn(),
        getRefreshToken: vi.fn(),
        revokeRefreshToken: vi.fn(),
    },
    connectRedis: vi.fn(),
    disconnectRedis: vi.fn(),
}));

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed_password'),
        compare: vi.fn(),
    },
}));

import prisma from '../../src/lib/prisma';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';

const app = createApp();

const mockUser = {
    id: 'admin-user-1',
    email: 'admin@example.com',
    fullName: 'Admin User',
    passwordHash: 'hashed_password',
    status: 'ACTIVE',
    phone: null,
    createdAt: new Date(),
    emailVerified: true,
    lockedUntil: null,
    totpEnabled: false,
    failedLoginAttempts: 0,
};

async function getAccessToken(): Promise<string> {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
    });

    return res.body.data.tokens.accessToken as string;
}

describe('GET /api/v1/admin/transactions/flagged', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 401 without token', async () => {
        const res = await request(app).get(
            '/api/v1/admin/transactions/flagged',
        );
        expect(res.status).toBe(401);
    });

    it('returns paginated flagged transactions when authenticated', async () => {
        const token = await getAccessToken();

        const flaggedTransactions = [
            {
                id: 'tx-1',
                reference: 'TXN-001',
                type: 'TRANSFER',
                amount: 50000,
                currency: 'GMD',
                status: 'COMPLETED',
                riskScore: 85,
                riskLevel: 'HIGH',
                fraudReasons: ['Very large transaction amount'],
                fraudReviewStatus: 'PENDING_REVIEW',
                fraudReviewNote: null,
                fraudReviewedBy: null,
                fraudReviewedAt: null,
                createdAt: new Date(),
            },
        ];

        vi.mocked(prisma.$transaction).mockResolvedValue([
            flaggedTransactions,
            1,
        ] as any);

        const res = await request(app)
            .get('/api/v1/admin/transactions/flagged?page=1&limit=20')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta.total).toBe(1);
    });
});

describe('PATCH /api/v1/admin/transactions/:transactionId/review', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 401 without token', async () => {
        const res = await request(app)
            .patch('/api/v1/admin/transactions/tx-1/review')
            .send({ action: 'APPROVE' });

        expect(res.status).toBe(401);
    });

    it('returns 200 and records approval decision', async () => {
        const token = await getAccessToken();

        vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
            id: 'tx-1',
            isFlagged: true,
            fraudReviewStatus: 'PENDING_REVIEW',
            reference: 'TXN-001',
            riskScore: 88,
        } as any);

        vi.mocked(prisma.transaction.update).mockResolvedValue({
            id: 'tx-1',
            reference: 'TXN-001',
            status: 'COMPLETED',
            riskScore: 88,
            riskLevel: 'HIGH',
            isFlagged: true,
            fraudReviewStatus: 'APPROVED',
            fraudReviewNote: 'Verified by compliance',
            fraudReviewedBy: 'admin-user-1',
            fraudReviewedAt: new Date(),
        } as any);

        const res = await request(app)
            .patch('/api/v1/admin/transactions/tx-1/review')
            .set('Authorization', `Bearer ${token}`)
            .send({
                action: 'APPROVE',
                note: 'Verified by compliance',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.fraudReviewStatus).toBe('APPROVED');
        expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('returns 409 when transaction already reviewed', async () => {
        const token = await getAccessToken();

        vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
            id: 'tx-1',
            isFlagged: true,
            fraudReviewStatus: 'APPROVED',
            reference: 'TXN-001',
            riskScore: 88,
        } as any);

        const res = await request(app)
            .patch('/api/v1/admin/transactions/tx-1/review')
            .set('Authorization', `Bearer ${token}`)
            .send({ action: 'REJECT' });

        expect(res.status).toBe(409);
    });
});
