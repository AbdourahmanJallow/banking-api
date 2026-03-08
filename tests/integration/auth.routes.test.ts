/**
 * Integration tests for /api/auth routes.
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

// ── POST /api/auth/register ────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 201 with user and tokens on success', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

        const res = await request(app).post('/api/v1/auth/register').send({
            email: 'alice@example.com',
            password: 'password123',
            fullName: 'Alice Smith',
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe('alice@example.com');
        expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('returns 409 when email is already taken', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

        const res = await request(app).post('/api/v1/auth/register').send({
            email: 'alice@example.com',
            password: 'password123',
            fullName: 'Alice Smith',
        });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('returns 422 on missing required fields', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'bad' });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 200 with tokens on valid credentials', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('returns 401 on wrong password', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'alice@example.com',
            password: 'wrong',
        });

        expect(res.status).toBe(401);
    });

    it('returns 401 when user does not exist', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'nobody@example.com',
            password: 'password123',
        });

        expect(res.status).toBe(401);
    });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 401 without Authorization header', async () => {
        const res = await request(app).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', 'Bearer invalid.jwt.token');

        expect(res.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
        // Login first to get a real signed token
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: 'alice@example.com',
            password: 'password123',
        });

        const { accessToken } = loginRes.body.data.tokens;

        const meRes = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.data.email).toBe('alice@example.com');
    });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/v1/auth/logout');
        expect(res.status).toBe(401);
    });

    it('returns 204 with valid token', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: 'alice@example.com',
            password: 'password123',
        });

        const { accessToken } = loginRes.body.data.tokens;

        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(204);
    });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 400/422 with missing refreshToken', async () => {
        const res = await request(app).post('/api/v1/auth/refresh').send({});
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 with invalid refresh token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: 'invalid.token.here' });

        expect(res.status).toBe(401);
    });
});
