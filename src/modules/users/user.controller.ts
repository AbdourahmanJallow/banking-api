import { Request, Response } from 'express';
import * as UserService from './user.service';
import { UpdateUserSchema, ChangePasswordSchema } from './user.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
    sendSuccess,
    sendNoContent,
    sendPaginated,
} from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await UserService.getProfile(req.user.userId);
    sendSuccess(res, user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const input = UpdateUserSchema.parse(req.body);
    const user = await UserService.updateProfile(req.user.userId, input);
    sendSuccess(res, user, 'Profile updated');
});

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const input = ChangePasswordSchema.parse(req.body);
        await UserService.changePassword(req.user.userId, input);
        sendNoContent(res);
    },
);

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { users, total } = await UserService.listUsers(page, limit);
    sendPaginated(res, users, total, page, limit);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.getProfile(req.params.id);
    sendSuccess(res, user);
});

export const deactivateUser = asyncHandler(
    async (req: Request, res: Response) => {
        await UserService.deactivateUser(req.params.id);
        sendNoContent(res);
    },
);
