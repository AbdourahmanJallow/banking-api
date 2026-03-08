import { Request, Response } from 'express';
import { authService } from './auth.service';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const input = RegisterSchema.parse(req.body);
    const result = await authService.register(input);
    sendCreated(res, result, 'Account created successfully');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const input = LoginSchema.parse(req.body);
    const result = await authService.login(input);
    sendSuccess(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = RefreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        await authService.logout(token, req.user.userId);
    }

    sendNoContent(res);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, req.user);
});
