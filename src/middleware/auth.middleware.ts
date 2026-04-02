import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { redisService } from '../config/redis';

export interface JwtPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

// Extend Express Request so controllers can access req.user
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * Verifies the Bearer token in the Authorization header,
 * checks the Redis blacklist, and attaches the decoded payload to req.user.
 */
export const authenticate = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw AppError.unauthorized('No token provided');
        }

        const token = authHeader.split(' ')[1];

        // Reject blacklisted tokens (logged-out sessions)
        if (redisService.connected) {
            const blacklisted = await redisService.isTokenBlacklisted(token);

            if (blacklisted)
                throw AppError.unauthorized('Token has been revoked');
        }

        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        } catch {
            throw AppError.unauthorized('Invalid or expired token');
        }

        req.user = decoded;
        next();
    },
);

/**
 * Use after authenticate() to restrict a route to the resource owner.
 */
export const requireOwnership = (getResourceUserId: (req: Request) => string) =>
    asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) throw AppError.unauthorized();

        const resourceUserId = getResourceUserId(req);

        if (req.user.userId !== resourceUserId) {
            throw AppError.forbidden('You do not have access to this resource');
        }

        next();
    });
