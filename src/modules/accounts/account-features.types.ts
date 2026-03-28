import { z } from 'zod';

// Account Preferences
export const AccountPreferencesSchema = z.object({
    notificationsEnabled: z.boolean().default(true),
    lowBalanceThreshold: z.number().positive().optional(),
    statementFrequency: z
        .enum(['WEEKLY', 'MONTHLY', 'QUARTERLY'])
        .default('MONTHLY'),
    cardlessWithdrawalAllowed: z.boolean().default(false),
});

export type AccountPreferences = z.infer<typeof AccountPreferencesSchema>;

// Beneficiary
export const CreateBeneficiarySchema = z.object({
    name: z.string().min(2),
    accountNumber: z.string().min(8),
    bankCode: z.string().optional(),
    phoneNumber: z.string().optional(),
});

export type CreateBeneficiaryInput = z.infer<typeof CreateBeneficiarySchema>;

// Recurring Payment / Standing Order
export enum Frequency {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    BIWEEKLY = 'BIWEEKLY',
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    ANNUALLY = 'ANNUALLY',
}

export enum StandingOrderStatus {
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export const CreateStandingOrderSchema = z.object({
    toAccountId: z.string().uuid(),
    amount: z.number().positive('Amount must be positive'),
    frequency: z.nativeEnum(Frequency),
    description: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
});

export type CreateStandingOrderInput = z.infer<
    typeof CreateStandingOrderSchema
>;

// Transaction Limits ───────────────────────────────────────────────────────
export const TransactionLimitsSchema = z.object({
    dailyWithdrawalLimit: z.number().positive().optional(),
    dailyTransactionLimit: z.number().positive().optional(),
    singleTransactionMaximum: z.number().positive().optional(),
});

export type TransactionLimits = z.infer<typeof TransactionLimitsSchema>;

// Alert Settings
export enum AlertType {
    LOW_BALANCE = 'LOW_BALANCE',
    LARGE_DEBIT = 'LARGE_DEBIT',
    UNUSUAL_ACTIVITY = 'UNUSUAL_ACTIVITY',
    STATEMENT_READY = 'STATEMENT_READY',
    STANDING_ORDER_EXECUTED = 'STANDING_ORDER_EXECUTED',
}

export const CreateAlertSchema = z.object({
    type: z.nativeEnum(AlertType),
    threshold: z.number().positive(),
    enabled: z.boolean().default(true),
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;

// Account Statement
export interface AccountStatement {
    id: string;
    accountId: string;
    period: {
        start: Date;
        end: Date;
    };
    openingBalance: number;
    closingBalance: number;
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
    createdAt: Date;
}

// Spending Analytics
export interface SpendingByCategory {
    category: string;
    amount: number;
    transactionCount: number;
    percentage: number;
}

export interface SpendingTrend {
    month: string;
    amount: number;
    transactionCount: number;
}

export interface TopMerchant {
    merchant: string;
    amount: number;
    transactionCount: number;
}

// Helper Types
export interface AccountStats {
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: number;
    balanceByStatus: {
        active: number;
        inactive: number;
        frozen: number;
    };
    monthlyStatements: number;
    activeBeneficiaries: number;
    activeStandingOrders: number;
}
