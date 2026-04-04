import { Request, Response } from 'express';
import { userService } from './user.service';
import {
    UpdateUserSchema,
    ChangePasswordSchema,
    VerifyEmailSchema,
    InitiatePasswordResetSchema,
    ResetPasswordSchema,
    EnableTOTPSchema,
    ConfirmTOTPSchema,
    ValidateTOTPSchema,
    DisableTOTPSchema,
    SubmitKYCSchema,
} from './user.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
    sendSuccess,
    sendNoContent,
    sendPaginated,
} from '../../utils/response';
import { UnauthorizedError, BadRequestError } from '../../utils/AppError';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const user = await userService.getProfile(req.user.userId);

    sendSuccess(res, user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = UpdateUserSchema.parse(req.body);

    const user = await userService.updateProfile(req.user.userId, input);

    sendSuccess(res, user, 'Profile updated');
});

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw new UnauthorizedError();

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

export const sendVerificationEmail = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw new UnauthorizedError();

        await userService.sendVerificationEmail(req.user.userId);

        sendSuccess(res, { message: 'Verification email sent' });
    },
);

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const input = VerifyEmailSchema.parse(req.body);

    const user = await userService.verifyEmail(input);

    sendSuccess(res, user, 'Email verified successfully');
});

export const initiatePasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
        const input = InitiatePasswordResetSchema.parse(req.body);

        await userService.initiatePasswordReset(input);

        // Don't reveal if email exists (security best practice)
        sendSuccess(res, {
            message: 'If email exists, reset link has been sent',
        });
    },
);

export const resetPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const input = ResetPasswordSchema.parse(req.body);

        await userService.resetPassword(input);

        sendSuccess(res, { message: 'Password reset successfully' });
    },
);

export const enableTOTP = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = EnableTOTPSchema.parse(req.body);

    const response = await userService.enableTOTP(req.user.userId, input);

    sendSuccess(res, response, 'TOTP setup initiated');
});

export const confirmTOTP = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = ConfirmTOTPSchema.parse(req.body);

    await userService.confirmTOTP(req.user.userId, input);

    sendSuccess(res, { message: '2FA enabled successfully' });
});

export const validateTOTP = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw new UnauthorizedError();

        const input = ValidateTOTPSchema.parse(req.body);

        const valid = await userService.validateTOTP(req.user.userId, input);

        sendSuccess(res, { valid });
    },
);

export const disableTOTP = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = DisableTOTPSchema.parse(req.body);

    await userService.disableTOTP(req.user.userId, input);

    sendSuccess(res, { message: '2FA disabled successfully' });
});

export const submitKYC = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = SubmitKYCSchema.parse(req.body);

    const user = await userService.submitKYC(req.user.userId, input);

    sendSuccess(res, user, 'KYC submitted for verification');
});

export const getKYCStatus = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw new UnauthorizedError();

        const status = await userService.getKYCStatus(req.user.userId);

        sendSuccess(res, status);
    },
);

export const approveKYC = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id as string;

    const user = await userService.approveKYC(userId);

    sendSuccess(res, user, 'KYC approved');
});

export const rejectKYC = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id as string;
    const { reason } = req.body;

    if (!reason) throw new BadRequestError('Rejection reason is required');

    const user = await userService.rejectKYC(userId, reason);

    sendSuccess(res, user, 'KYC rejected');
});
