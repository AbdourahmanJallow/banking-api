/**
 * Integration tests for /api/accounts routes.
 * Prisma and Redis are mocked so no real DB or cache is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mocks (must come before imports that use them) ────────────────────────────

vi.mock('../../src/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        account: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
        },
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

vi.mock('../../src/utils/generateAccountNumber', () => ({
    generateAccountNumber: vi.fn().mockReturnValue('ACC1234567890'),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import prisma from '../../src/lib/prisma';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';

const app = createApp();

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockUser = {
    id: 'user-id-123',
    email: 'alice@example.com',
    fullName: 'Alice Smith',
    passwordHash: 'hashed_password',
    status: 'ACTIVE',
    phone: null,
    createdAt: new Date(),
};

const mockAccount = {
    id: 'account-id-123',
    userId: 'user-id-123',
    accountNumber: 'ACC1234567890',
    currency: 'GMD',
    balance: 0,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
};

/** Logs in via the auth route and returns a valid JWT access token. */
async function getAccessToken(): Promise<string> {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app).post('/api/v1/auth/login').send({
        email: 'alice@example.com',
        password: 'password123',
    });

    return res.body.data.tokens.accessToken as string;
}

// ── POST /api/accounts ────────────────────────────────────────────────────────

describe('POST /api/accounts', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 201 with new account on success', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findUnique).mockResolvedValue(null); // no collision
        vi.mocked(prisma.account.create).mockResolvedValue(mockAccount as any);

        const res = await request(app)
            .post('/api/v1/accounts')
            .set('Authorization', `Bearer ${token}`)
            .send({ currency: 'GMD' });

        expect(res.status).toBe(201);
        expect(res.body.data.currency).toBe('GMD');
        expect(res.body.data.accountNumber).toBe('ACC1234567890');
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/v1/accounts')
            .send({ currency: 'GMD' });

        expect(res.status).toBe(401);
    });

    it('returns 422 on invalid currency', async () => {
        const token = await getAccessToken();

        const res = await request(app)
            .post('/api/v1/accounts')
            .set('Authorization', `Bearer ${token}`)
            .send({ currency: 'US' }); // not 3 chars

        expect(res.status).toBe(422);
    });
});

// ── GET /api/accounts ─────────────────────────────────────────────────────────

describe('GET /api/accounts', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 200 with list of accounts', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findMany).mockResolvedValue([
            mockAccount,
        ] as any);

        const res = await request(app)
            .get('/api/v1/accounts')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app).get('/api/v1/accounts');
        expect(res.status).toBe(401);
    });
});

// ── GET /api/accounts/:id ─────────────────────────────────────────────────────

describe('GET /api/accounts/:id', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 200 with account data for the owner', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findUnique).mockResolvedValue(
            mockAccount as any,
        );

        const res = await request(app)
            .get('/api/v1/accounts/account-id-123')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('account-id-123');
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app).get('/api/v1/accounts/account-id-123');
        expect(res.status).toBe(401);
    });

    it('returns 404 when account does not exist', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

        const res = await request(app)
            .get('/api/v1/accounts/missing-id')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it('returns 403 when account belongs to another user', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
            ...mockAccount,
            userId: 'other-user-id',
        } as any);

        const res = await request(app)
            .get('/api/v1/accounts/account-id-123')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

// ── PATCH /api/accounts/:id/status ───────────────────────────────────────────

describe('PATCH /api/accounts/:id/status', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 200 with updated account on success', async () => {
        const token = await getAccessToken();
        const updated = { ...mockAccount, status: 'FROZEN' };
        vi.mocked(prisma.account.findUnique).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(prisma.account.update).mockResolvedValue(updated as any);

        const res = await request(app)
            .patch('/api/v1/accounts/account-id-123/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'FROZEN' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('FROZEN');
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app)
            .patch('/api/v1/accounts/account-id-123/status')
            .send({ status: 'FROZEN' });

        expect(res.status).toBe(401);
    });

    it('returns 422 on invalid status value', async () => {
        const token = await getAccessToken();

        const res = await request(app)
            .patch('/api/v1/accounts/account-id-123/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'DELETED' }); // not a valid enum value

        expect(res.status).toBe(422);
    });

    it('returns 404 when account does not exist', async () => {
        const token = await getAccessToken();
        vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/v1/accounts/missing-id/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'ACTIVE' });

        expect(res.status).toBe(404);
    });
});
