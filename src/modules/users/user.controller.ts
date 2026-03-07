import { Request, Response } from 'express';
import { userService } from './user.service';
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

    const user = await userService.getProfile(req.user.userId);

    sendSuccess(res, user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const input = UpdateUserSchema.parse(req.body);

    const user = await userService.updateProfile(req.user.userId, input);

    sendSuccess(res, user, 'Profile updated');
});

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = ChangePasswordSchema.parse(req.body);

        await userService.changePassword(req.user.userId, input);

        sendNoContent(res);
    },
);

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;

    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const { users, total } = await userService.listUsers(page, limit);

    sendPaginated(res, users, total, page, limit);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.params.id as string);
    sendSuccess(res, user);
});

export const deactivateUser = asyncHandler(
    async (req: Request, res: Response) => {
        await userService.deactivateUser(req.params.id as string);
        sendNoContent(res);
    },
);
