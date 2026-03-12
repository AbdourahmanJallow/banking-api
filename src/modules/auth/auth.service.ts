import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { config } from '../../config';
import { AppError } from '../../utils/AppError';
import { redisService } from '../../config/redis';
import {
    RegisterInput,
    LoginInput,
    TokenPair,
    AuthResponse,
} from './auth.types';
import { auditService } from '../audit/audit.service';

/** Converts a JWT expiry string like "7d", "15m", "1h" to seconds */
export function parseTTL(exp: string): number {
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 3600;

    return parseInt(match[1]) * (units[match[2]] ?? 1);
}

class AuthService {
    private readonly SALT_ROUNDS = 12;

    private generateTokens(userId: string, email: string): TokenPair {
        const accessToken = jwt.sign({ userId, email }, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        });

        const refreshToken = jwt.sign({ userId, email }, config.jwt.secret, {
            expiresIn: config.jwt
                .refreshExpiresIn as jwt.SignOptions['expiresIn'],
        });

        return { accessToken, refreshToken };
    }

    async register(input: RegisterInput): Promise<AuthResponse> {
        const existing = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (existing)
            throw AppError.conflict('Email already in use', 'EMAIL_TAKEN');

        const passwordHash = await bcrypt.hash(
            input.password,
            this.SALT_ROUNDS,
        );

        const user = await prisma.user.create({
            data: {
                email: input.email,
                passwordHash,
                fullName: input.fullName,
                phone: input.phone,
            },
        });

        const tokens = this.generateTokens(user.id, user.email);

        auditService.log({
            userId: user.id,
            action: 'AUTH.REGISTER',
            resource: 'USER',
            resourceId: user.id,
            metadata: { email: user.email, fullName: user.fullName },
        });

        return {
            user: { id: user.id, email: user.email, fullName: user.fullName },
            tokens,
        };
    }

    async login(input: LoginInput): Promise<AuthResponse> {
        const user = await prisma.user.findUnique({
            where: { email: input.email },
        });
        if (!user) {
            auditService.log({
                action: 'AUTH.LOGIN_FAILED',
                resource: 'AUTH',
                metadata: { email: input.email, reason: 'USER_NOT_FOUND' },
            });
            throw AppError.unauthorized('Invalid email or password');
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
            auditService.log({
                userId: user.id,
                action: 'AUTH.LOGIN_FAILED',
                resource: 'AUTH',
                metadata: { email: input.email, reason: 'WRONG_PASSWORD' },
            });
            throw AppError.unauthorized('Invalid email or password');
        }

        if (user.status !== 'ACTIVE') {
            auditService.log({
                userId: user.id,
                action: 'AUTH.LOGIN_FAILED',
                resource: 'AUTH',
                metadata: { email: input.email, reason: 'ACCOUNT_SUSPENDED' },
            });
            throw AppError.forbidden(
                'Account is suspended',
                'ACCOUNT_SUSPENDED',
            );
        }

        const tokens = this.generateTokens(user.id, user.email);

        if (redisService.connected) {
            await redisService.storeRefreshToken(
                user.id,
                tokens.refreshToken,
                parseTTL(config.jwt.refreshExpiresIn),
            );
        }

        auditService.log({
            userId: user.id,
            action: 'AUTH.LOGIN',
            resource: 'AUTH',
            metadata: { email: user.email },
        });

        return {
            user: { id: user.id, email: user.email, fullName: user.fullName },
            tokens,
        };
    }

    async refreshToken(token: string): Promise<TokenPair> {
        let payload: { userId: string; email: string };

        try {
            payload = jwt.verify(token, config.jwt.secret) as typeof payload;
        } catch {
            throw AppError.unauthorized('Invalid or expired refresh token');
        }

        // Reject if the refresh token was revoked on logout
        if (redisService.connected) {
            const stored = await redisService.getRefreshToken(payload.userId);
            if (!stored || stored !== token) {
                throw AppError.unauthorized('Refresh token has been revoked');
            }
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
        });

        if (!user || user.status !== 'ACTIVE')
            throw AppError.unauthorized('User not found or inactive');

        const tokens = this.generateTokens(user.id, user.email);

        // Rotate: store new refresh token, revoke the old one
        if (redisService.connected) {
            await redisService.storeRefreshToken(
                user.id,
                tokens.refreshToken,
                parseTTL(config.jwt.refreshExpiresIn),
            );
        }

        return tokens;
    }

    /**
     * Blacklists the access token and revokes the stored refresh token.
     * TTL of the blacklist entry mirrors the access token's remaining lifetime.
     */
    async logout(accessToken: string, userId: string): Promise<void> {
        if (!redisService.connected) return;

        try {
            const decoded = jwt.decode(accessToken) as { exp?: number } | null;

            const remainingTTL = decoded?.exp
                ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1)
                : parseTTL(config.jwt.expiresIn);

            await Promise.all([
                redisService.blacklistToken(accessToken, remainingTTL),
                redisService.revokeRefreshToken(userId),
            ]);
        } catch (err) {
            console.warn('[Auth] logout Redis error (non-fatal):', err);
        }

        auditService.log({
            userId,
            action: 'AUTH.LOGOUT',
            resource: 'AUTH',
        });
    }
}

export const authService = new AuthService();
