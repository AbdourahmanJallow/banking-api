import { Request, Response } from 'express';
import { accountService } from './account.service';
import {
    CreateAccountSchema,
    UpdateAccountStatusSchema,
} from './account.types';
import {
    CreateBeneficiarySchema,
    CreateStandingOrderSchema,
    AccountPreferencesSchema,
    TransactionLimitsSchema,
    CreateAlertSchema,
} from './account-features.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const createAccount = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = CreateAccountSchema.parse(req.body);

        const account = await accountService.createAccount(
            req.user.userId,
            input,
        );

        sendCreated(res, account, 'Account created successfully');
    },
);

export const getMyAccounts = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accounts = await accountService.getUserAccounts(req.user.userId);

        sendSuccess(res, accounts);
    },
);

export const getAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const account = await accountService.getAccount(
        req.params.id as string,
        req.user.userId,
    );
    sendSuccess(res, account);
});

export const updateAccountStatus = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = UpdateAccountStatusSchema.parse(req.body);

        const account = await accountService.updateAccountStatus(
            req.params.id as string,
            input,
            req.user.userId,
        );

        sendSuccess(res, account, 'Account status updated');
    },
);

// ── Beneficiary Controllers ──────────────────────────────────────────────

export const addBeneficiary = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = CreateBeneficiarySchema.parse(req.body);
        const accountId = req.params.accountId as string;

        const beneficiary = await accountService.addBeneficiary(
            accountId,
            input,
            req.user.userId,
        );

        sendCreated(res, beneficiary, 'Beneficiary added successfully');
    },
);

export const removeBeneficiary = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const beneficiaryId = req.params.beneficiaryId as string;

        await accountService.removeBeneficiary(beneficiaryId, req.user.userId);

        sendSuccess(res, null, 'Beneficiary removed successfully');
    },
);

export const listBeneficiaries = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;

        const beneficiaries = await accountService.listBeneficiaries(
            accountId,
            req.user.userId,
        );

        sendSuccess(res, beneficiaries);
    },
);

// ── Standing Order Controllers ──────────────────────────────────────────

export const createStandingOrder = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = CreateStandingOrderSchema.parse(req.body);
        const accountId = req.params.accountId as string;

        const order = await accountService.createStandingOrder(
            accountId,
            input,
            req.user.userId,
        );

        sendCreated(res, order, 'Standing order created successfully');
    },
);

export const pauseStandingOrder = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const orderId = req.params.orderId as string;

        await accountService.pauseStandingOrder(orderId, req.user.userId);

        sendSuccess(res, null, 'Standing order paused successfully');
    },
);

export const resumeStandingOrder = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const orderId = req.params.orderId as string;

        await accountService.resumeStandingOrder(orderId, req.user.userId);

        sendSuccess(res, null, 'Standing order resumed successfully');
    },
);

export const listStandingOrders = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;

        const orders = await accountService.listStandingOrders(
            accountId,
            req.user.userId,
        );

        sendSuccess(res, orders);
    },
);

// ── Preferences Controllers ──────────────────────────────────────────────

export const updatePreferences = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = AccountPreferencesSchema.partial().parse(req.body);
        const accountId = req.params.accountId as string;

        const preferences = await accountService.updatePreferences(
            accountId,
            input,
            req.user.userId,
        );

        sendSuccess(
            res,
            preferences,
            'Account preferences updated successfully',
        );
    },
);

export const getPreferences = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;

        const preferences = await accountService.getPreferences(
            accountId,
            req.user.userId,
        );

        sendSuccess(res, preferences);
    },
);

// ── Transaction Limits Controllers ──────────────────────────────────────

export const setTransactionLimits = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const input = TransactionLimitsSchema.parse(req.body);
        const accountId = req.params.accountId as string;

        const limits = await accountService.setTransactionLimits(
            accountId,
            input,
            req.user.userId,
        );

        sendCreated(res, limits, 'Transaction limits set successfully');
    },
);

export const getTransactionLimits = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;

        const limits = await accountService.getTransactionLimits(
            accountId,
            req.user.userId,
        );

        sendSuccess(res, limits || {});
    },
);

// ── Alert Controllers ──────────────────────────────────────────────────

export const createAlert = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const input = CreateAlertSchema.parse(req.body);
    const accountId = req.params.accountId as string;

    const alert = await accountService.createAlert(
        accountId,
        input,
        req.user.userId,
    );

    sendCreated(res, alert, 'Alert created successfully');
});

export const disableAlert = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const alertId = req.params.alertId as string;

        await accountService.disableAlert(alertId, req.user.userId);

        sendSuccess(res, null, 'Alert disabled successfully');
    },
);

export const listAlerts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const accountId = req.params.accountId as string;

    const alerts = await accountService.listAlerts(accountId, req.user.userId);

    sendSuccess(res, alerts);
});

// ── Statement Controllers ──────────────────────────────────────────────

export const generateStatement = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const { startDate, endDate } = req.body;
        if (!startDate || !endDate)
            throw AppError.badRequest(
                'startDate and endDate are required',
                'MISSING_DATE_PARAMS',
            );

        const accountId = req.params.accountId as string;

        const statement = await accountService.generateStatement(
            accountId,
            new Date(startDate),
            new Date(endDate),
            req.user.userId,
        );

        sendCreated(res, statement, 'Statement generated successfully');
    },
);

export const listStatements = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, parseInt(req.query.limit as string) || 10);

        const result = await accountService.listStatements(
            accountId,
            req.user.userId,
            page,
            limit,
        );

        sendSuccess(res, result);
    },
);

// ── Analytics Controllers ──────────────────────────────────────────────

export const getSpendingByCategory = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate)
            throw AppError.badRequest(
                'startDate and endDate query parameters are required',
                'MISSING_DATE_PARAMS',
            );

        const analytics = await accountService.getSpendingByCategory(
            accountId,
            req.user.userId,
            new Date(startDate as string),
            new Date(endDate as string),
        );

        sendSuccess(res, analytics);
    },
);

export const getMonthlySpendingTrend = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;
        const months = Math.min(
            36,
            Math.max(1, parseInt(req.query.months as string) || 12),
        );

        const trends = await accountService.getMonthlySpendingTrend(
            accountId,
            req.user.userId,
            months,
        );

        sendSuccess(res, trends);
    },
);

export const getTopMerchants = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const accountId = req.params.accountId as string;
        const limit = Math.min(50, parseInt(req.query.limit as string) || 5);

        const merchants = await accountService.getTopMerchants(
            accountId,
            req.user.userId,
            limit,
        );

        sendSuccess(res, merchants);
    },
);
