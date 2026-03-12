/**
 * Unit tests for auth.service.ts
 * All external dependencies (Prisma, Redis, bcrypt, jwt) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
        },
    },
}));

vi.mock('../../src/config/redis', () => ({
    redisService: {
        connected: false,
        blacklistToken: vi.fn(),
        isTokenBlacklisted: vi.fn(),
        storeRefreshToken: vi.fn(),
        getRefreshToken: vi.fn(),
        revokeRefreshToken: vi.fn(),
    },
}));

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed_password'),
        compare: vi.fn(),
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn().mockReturnValue('mock_token'),
        verify: vi.fn(),
        decode: vi.fn(),
    },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import prisma from '../../src/lib/prisma';
import { redisService } from '../../src/config/redis';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authService, parseTTL } from '../../src/modules/auth/auth.service';

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

// ── parseTTL ──────────────────────────────────────────────────────────────────

describe('parseTTL', () => {
    it('converts seconds', () => expect(parseTTL('30s')).toBe(30));
    it('converts minutes', () => expect(parseTTL('15m')).toBe(900));
    it('converts hours', () => expect(parseTTL('1h')).toBe(3600));
    it('converts days', () => expect(parseTTL('7d')).toBe(604800));
    it('defaults to 3600 for unknown format', () =>
        expect(parseTTL('unknown')).toBe(3600));
});

// ── register ──────────────────────────────────────────────────────────────────

describe('authService.register', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates a new user and returns tokens', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

        const result = await authService.register({
            email: 'alice@example.com',
            password: 'password123',
            fullName: 'Alice Smith',
        });

        expect(prisma.user.create).toHaveBeenCalledOnce();
        expect(result.user.email).toBe('alice@example.com');
        expect(result.tokens.accessToken).toBe('mock_token');
    });

    it('throws CONFLICT when email already exists', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

        await expect(
            authService.register({
                email: 'alice@example.com',
                password: 'password123',
                fullName: 'Alice Smith',
            }),
        ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
    });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns tokens on valid credentials', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const result = await authService.login({
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(result.user.id).toBe('user-id-123');
        expect(result.tokens.accessToken).toBeDefined();
    });

    it('throws UNAUTHORIZED when user not found', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(
            authService.login({
                email: 'ghost@example.com',
                password: 'password123',
            }),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws UNAUTHORIZED on wrong password', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
            authService.login({
                email: 'alice@example.com',
                password: 'wrong',
            }),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws FORBIDDEN for inactive account', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            ...mockUser,
            status: 'INACTIVE',
        } as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        await expect(
            authService.login({
                email: 'alice@example.com',
                password: 'password123',
            }),
        ).rejects.toMatchObject({ statusCode: 403 });
    });
});

// ── refreshToken ──────────────────────────────────────────────────────────────

describe('authService.refreshToken', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns new token pair on valid refresh token', async () => {
        vi.mocked(jwt.verify).mockReturnValue({
            userId: 'user-id-123',
            email: 'alice@example.com',
        } as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        // Redis is disconnected in mock → skip revocation check

        const result = await authService.refreshToken('valid_refresh_token');

        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
    });

    it('throws UNAUTHORIZED on invalid token', async () => {
        vi.mocked(jwt.verify).mockImplementation(() => {
            throw new Error('invalid');
        });

        await expect(
            authService.refreshToken('bad_token'),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('rejects revoked refresh token when Redis is connected', async () => {
        const redisMock = redisService as any;
        redisMock.connected = true;
        vi.mocked(jwt.verify).mockReturnValue({
            userId: 'user-id-123',
            email: 'alice@example.com',
        } as any);
        vi.mocked(redisService.getRefreshToken).mockResolvedValue(
            'different_token',
        );

        await expect(
            authService.refreshToken('valid_token'),
        ).rejects.toMatchObject({ statusCode: 401 });

        redisMock.connected = false; // restore
    });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('authService.logout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('blacklists token and revokes refresh token when Redis is connected', async () => {
        const redisMock = redisService as any;
        redisMock.connected = true;
        vi.mocked(jwt.decode).mockReturnValue({
            exp: Math.floor(Date.now() / 1000) + 3600,
        } as any);
        vi.mocked(redisService.blacklistToken).mockResolvedValue(undefined);
        vi.mocked(redisService.revokeRefreshToken).mockResolvedValue(undefined);

        await authService.logout('access_token', 'user-id-123');

        expect(redisService.blacklistToken).toHaveBeenCalledWith(
            'access_token',
            expect.any(Number),
        );
        expect(redisService.revokeRefreshToken).toHaveBeenCalledWith(
            'user-id-123',
        );

        redisMock.connected = false;
    });

    it('does nothing when Redis is disconnected', async () => {
        (redisService as any).connected = false;

        await authService.logout('access_token', 'user-id-123');

        expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });
});
