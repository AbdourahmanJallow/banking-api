import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

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
 * Verifies the Bearer token in the Authorization header and
 * attaches the decoded payload to req.user.
 */
export const authenticate = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw AppError.unauthorized('No token provided');
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        req.user = decoded;
        next();
    },
);

/**
 * Use after authenticate() to restrict a route to certain user IDs.
 * Controllers can call this for ownership checks.
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
