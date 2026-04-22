import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config';

const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Banking API',
        version: '1.0.0',
        description:
            'REST API documentation for the Digital Banking Backend System.',
    },
    servers: [
        {
            url: config.appUrl,
            description: 'Configured application URL',
        },
        {
            url: 'http://localhost:3000',
            description: 'Local development',
        },
    ],
    tags: [
        { name: 'Health' },
        { name: 'Auth' },
        { name: 'Users' },
        { name: 'Accounts' },
        { name: 'Transactions' },
        { name: 'Admin' },
        { name: 'Audit' },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    error: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', example: 'BAD_REQUEST' },
                            message: {
                                type: 'string',
                                example: 'Invalid request payload',
                            },
                        },
                    },
                },
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: {
                        type: 'string',
                        format: 'date-time',
                    },
                },
            },
            GenericRequestBody: {
                type: 'object',
                additionalProperties: true,
                example: {
                    key: 'value',
                },
            },
            AuthRegisterRequest: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        example: 'user@example.com',
                    },
                    password: {
                        type: 'string',
                        format: 'password',
                        example: 'StrongPassword123!',
                    },
                    fullName: { type: 'string', example: 'John Doe' },
                    phone: { type: 'string', example: '+1234567890' },
                },
            },
            AuthLoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        example: 'user@example.com',
                    },
                    password: {
                        type: 'string',
                        format: 'password',
                        example: 'StrongPassword123!',
                    },
                    totpToken: { type: 'string', example: '123456' },
                },
            },
            AuthRefreshRequest: {
                type: 'object',
                properties: {
                    refreshToken: { type: 'string', example: 'refresh-token' },
                },
            },
            VerifyEmailRequest: {
                type: 'object',
                required: ['token'],
                properties: {
                    token: { type: 'string', example: 'verification-token' },
                },
            },
            PasswordResetInitiateRequest: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        example: 'user@example.com',
                    },
                },
            },
            PasswordResetCompleteRequest: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                    token: { type: 'string', example: 'reset-token' },
                    newPassword: {
                        type: 'string',
                        format: 'password',
                        example: 'NewStrongPassword123!',
                    },
                },
            },
            ChangePasswordRequest: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                    currentPassword: { type: 'string', format: 'password' },
                    newPassword: { type: 'string', format: 'password' },
                },
            },
            UpdateProfileRequest: {
                type: 'object',
                properties: {
                    fullName: { type: 'string', example: 'John Doe' },
                    phone: { type: 'string', example: '+2207000000' },
                },
            },
            EnableTotpRequest: {
                type: 'object',
                required: ['password'],
                properties: {
                    password: { type: 'string', format: 'password' },
                },
            },
            ConfirmTotpRequest: {
                type: 'object',
                required: ['secret', 'token'],
                properties: {
                    secret: { type: 'string', example: 'base32secret' },
                    token: { type: 'string', example: '123456' },
                },
            },
            ValidateTotpRequest: {
                type: 'object',
                required: ['token'],
                properties: {
                    token: { type: 'string', example: '123456' },
                },
            },
            DisableTotpRequest: {
                type: 'object',
                required: ['password'],
                properties: {
                    password: { type: 'string', format: 'password' },
                },
            },
            SubmitKycRequest: {
                type: 'object',
                required: [
                    'dateOfBirth',
                    'nationalId',
                    'idType',
                    'address',
                    'city',
                    'country',
                    'postalCode',
                ],
                properties: {
                    dateOfBirth: {
                        type: 'string',
                        format: 'date',
                        example: '1995-05-12',
                    },
                    nationalId: { type: 'string', example: 'A1234567' },
                    idType: {
                        type: 'string',
                        enum: ['PASSPORT', 'NATIONAL_ID', 'DRIVER_LICENSE'],
                    },
                    address: { type: 'string', example: 'Kairaba Avenue' },
                    city: { type: 'string', example: 'Banjul' },
                    country: { type: 'string', example: 'GM' },
                    postalCode: { type: 'string', example: '00220' },
                },
            },
            TotpCodeRequest: {
                type: 'object',
                required: ['code'],
                properties: {
                    code: { type: 'string', example: '123456' },
                },
            },
            KycRejectRequest: {
                type: 'object',
                required: ['reason'],
                properties: {
                    reason: { type: 'string', example: 'Document not clear' },
                },
            },
            TransferRequest: {
                type: 'object',
                required: ['fromAccountId', 'toAccountId', 'amount'],
                properties: {
                    fromAccountId: {
                        type: 'string',
                        example: 'acc_sender_123',
                    },
                    toAccountId: {
                        type: 'string',
                        example: 'acc_receiver_456',
                    },
                    amount: { type: 'number', example: 150.5 },
                    currency: { type: 'string', example: 'USD' },
                    reference: { type: 'string', example: 'Rent payment' },
                },
            },
            DepositRequest: {
                type: 'object',
                required: ['accountId', 'amount'],
                properties: {
                    accountId: { type: 'string', example: 'acc_123' },
                    amount: { type: 'number', example: 500 },
                    reference: { type: 'string', example: 'Cash deposit' },
                },
            },
            WithdrawalRequest: {
                type: 'object',
                required: ['accountId', 'amount'],
                properties: {
                    accountId: { type: 'string', example: 'acc_123' },
                    amount: { type: 'number', example: 100 },
                    reference: { type: 'string', example: 'ATM withdrawal' },
                },
            },
            CreateAccountRequest: {
                type: 'object',
                properties: {
                    currency: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 3,
                        example: 'GMD',
                    },
                },
            },
            UpdateAccountStatusRequest: {
                type: 'object',
                required: ['status'],
                properties: {
                    status: {
                        type: 'string',
                        enum: ['ACTIVE', 'INACTIVE', 'FROZEN'],
                    },
                },
            },
            CreateBeneficiaryRequest: {
                type: 'object',
                required: ['name', 'accountNumber'],
                properties: {
                    name: { type: 'string', example: 'Jane Doe' },
                    accountNumber: { type: 'string', example: '1234567890' },
                    bankCode: { type: 'string', example: '001' },
                    phoneNumber: { type: 'string', example: '+2207123456' },
                },
            },
            CreateStandingOrderRequest: {
                type: 'object',
                required: ['toAccountId', 'amount', 'frequency', 'startDate'],
                properties: {
                    toAccountId: { type: 'string', format: 'uuid' },
                    amount: { type: 'number', example: 250 },
                    frequency: {
                        type: 'string',
                        enum: [
                            'DAILY',
                            'WEEKLY',
                            'BIWEEKLY',
                            'MONTHLY',
                            'QUARTERLY',
                            'ANNUALLY',
                        ],
                    },
                    description: {
                        type: 'string',
                        example: 'Monthly savings transfer',
                    },
                    startDate: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-05-01T00:00:00.000Z',
                    },
                    endDate: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-12-01T00:00:00.000Z',
                    },
                },
            },
            UpdatePreferencesRequest: {
                type: 'object',
                properties: {
                    notificationsEnabled: { type: 'boolean', example: true },
                    lowBalanceThreshold: { type: 'number', example: 100 },
                    statementFrequency: {
                        type: 'string',
                        enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY'],
                    },
                    cardlessWithdrawalAllowed: {
                        type: 'boolean',
                        example: false,
                    },
                },
            },
            TransactionLimitsRequest: {
                type: 'object',
                properties: {
                    dailyWithdrawalLimit: { type: 'number', example: 1000 },
                    dailyTransactionLimit: { type: 'number', example: 2000 },
                    singleTransactionMaximum: {
                        type: 'number',
                        example: 500,
                    },
                },
            },
            CreateAlertRequest: {
                type: 'object',
                required: ['type', 'threshold'],
                properties: {
                    type: {
                        type: 'string',
                        enum: [
                            'LOW_BALANCE',
                            'LARGE_DEBIT',
                            'UNUSUAL_ACTIVITY',
                            'STATEMENT_READY',
                            'STANDING_ORDER_EXECUTED',
                        ],
                    },
                    threshold: { type: 'number', example: 500 },
                    enabled: { type: 'boolean', example: true },
                },
            },
            GenerateStatementRequest: {
                type: 'object',
                required: ['startDate', 'endDate'],
                properties: {
                    startDate: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-01-01T00:00:00.000Z',
                    },
                    endDate: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-01-31T23:59:59.999Z',
                    },
                },
            },
            SetUserStatusRequest: {
                type: 'object',
                required: ['status'],
                properties: {
                    status: {
                        type: 'string',
                        enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
                    },
                },
            },
            ReviewFlaggedTransactionRequest: {
                type: 'object',
                required: ['action'],
                properties: {
                    action: {
                        type: 'string',
                        enum: ['APPROVE', 'REJECT'],
                    },
                    note: { type: 'string', example: 'Looks legitimate' },
                },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Service health check',
                responses: {
                    '200': {
                        description: 'Service is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/HealthResponse',
                                },
                            },
                        },
                    },
                },
            },
        },

        '/api/v1/auth/register': {
            post: { tags: ['Auth'], summary: 'Register new user' },
        },
        '/api/v1/auth/login': {
            post: { tags: ['Auth'], summary: 'Login user' },
        },
        '/api/v1/auth/refresh': {
            post: { tags: ['Auth'], summary: 'Refresh access token' },
        },
        '/api/v1/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout user',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get authenticated user profile',
                security: [{ BearerAuth: [] }],
            },
        },

        '/api/v1/users/email/verify': {
            post: { tags: ['Users'], summary: 'Verify email' },
        },
        '/api/v1/users/email/resend-verification': {
            post: {
                tags: ['Users'],
                summary: 'Resend verification email',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/password/reset-initiate': {
            post: { tags: ['Users'], summary: 'Initiate password reset' },
        },
        '/api/v1/users/password/reset-complete': {
            post: { tags: ['Users'], summary: 'Complete password reset' },
        },
        '/api/v1/users/me': {
            get: {
                tags: ['Users'],
                summary: 'Get current user',
                security: [{ BearerAuth: [] }],
            },
            patch: {
                tags: ['Users'],
                summary: 'Update current user',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/me/password': {
            patch: {
                tags: ['Users'],
                summary: 'Change current user password',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/2fa/enable': {
            post: {
                tags: ['Users'],
                summary: 'Enable TOTP',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/2fa/confirm': {
            post: {
                tags: ['Users'],
                summary: 'Confirm TOTP setup',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/2fa/validate': {
            post: {
                tags: ['Users'],
                summary: 'Validate TOTP code',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/2fa/disable': {
            post: {
                tags: ['Users'],
                summary: 'Disable TOTP',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/kyc/submit': {
            post: {
                tags: ['Users'],
                summary: 'Submit KYC data',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/kyc/status': {
            get: {
                tags: ['Users'],
                summary: 'Get KYC status',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users': {
            get: {
                tags: ['Users'],
                summary: 'List users (admin intent)',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/{id}': {
            get: {
                tags: ['Users'],
                summary: 'Get user by id',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/{id}/deactivate': {
            patch: {
                tags: ['Users'],
                summary: 'Deactivate user',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/{id}/kyc/approve': {
            patch: {
                tags: ['Users'],
                summary: 'Approve user KYC',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/users/{id}/kyc/reject': {
            patch: {
                tags: ['Users'],
                summary: 'Reject user KYC',
                security: [{ BearerAuth: [] }],
            },
        },

        '/api/v1/accounts': {
            post: {
                tags: ['Accounts'],
                summary: 'Create account',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'Get authenticated user accounts',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{id}': {
            get: {
                tags: ['Accounts'],
                summary: 'Get account by id',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{id}/status': {
            patch: {
                tags: ['Accounts'],
                summary: 'Update account status',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/beneficiaries': {
            post: {
                tags: ['Accounts'],
                summary: 'Add beneficiary',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'List beneficiaries',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/beneficiaries/{beneficiaryId}': {
            delete: {
                tags: ['Accounts'],
                summary: 'Remove beneficiary',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/standing-orders': {
            post: {
                tags: ['Accounts'],
                summary: 'Create standing order',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'List standing orders',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/standing-orders/{orderId}/pause': {
            patch: {
                tags: ['Accounts'],
                summary: 'Pause standing order',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/standing-orders/{orderId}/resume': {
            patch: {
                tags: ['Accounts'],
                summary: 'Resume standing order',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/preferences': {
            get: {
                tags: ['Accounts'],
                summary: 'Get account preferences',
                security: [{ BearerAuth: [] }],
            },
            put: {
                tags: ['Accounts'],
                summary: 'Update account preferences',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/limits': {
            post: {
                tags: ['Accounts'],
                summary: 'Set account transaction limits',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'Get account transaction limits',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/alerts': {
            post: {
                tags: ['Accounts'],
                summary: 'Create account alert',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'List account alerts',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/alerts/{alertId}': {
            delete: {
                tags: ['Accounts'],
                summary: 'Disable account alert',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/statements': {
            post: {
                tags: ['Accounts'],
                summary: 'Generate account statement',
                security: [{ BearerAuth: [] }],
            },
            get: {
                tags: ['Accounts'],
                summary: 'List account statements',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/analytics/spending': {
            get: {
                tags: ['Accounts'],
                summary: 'Get spending by category',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/analytics/trends': {
            get: {
                tags: ['Accounts'],
                summary: 'Get monthly spending trend',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/accounts/{accountId}/analytics/merchants': {
            get: {
                tags: ['Accounts'],
                summary: 'Get top merchants analytics',
                security: [{ BearerAuth: [] }],
            },
        },

        '/api/v1/transactions/transfer': {
            post: {
                tags: ['Transactions'],
                summary: 'Create transfer transaction',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/transactions/deposit': {
            post: {
                tags: ['Transactions'],
                summary: 'Create deposit transaction',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/transactions/withdrawal': {
            post: {
                tags: ['Transactions'],
                summary: 'Create withdrawal transaction',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/transactions/{id}': {
            get: {
                tags: ['Transactions'],
                summary: 'Get transaction by id',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/transactions/account/{accountId}': {
            get: {
                tags: ['Transactions'],
                summary: 'Get transactions for account',
                security: [{ BearerAuth: [] }],
            },
        },

        '/api/v1/admin/dashboard': {
            get: {
                tags: ['Admin'],
                summary: 'Admin dashboard metrics',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/system-health': {
            get: {
                tags: ['Admin'],
                summary: 'System health metrics',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/kyc-analytics': {
            get: {
                tags: ['Admin'],
                summary: 'KYC analytics',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/users': {
            get: {
                tags: ['Admin'],
                summary: 'Admin list users',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/users/{userId}/status': {
            patch: {
                tags: ['Admin'],
                summary: 'Set user status',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/users/{userId}/activity': {
            get: {
                tags: ['Admin'],
                summary: 'Get user activity',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/transactions': {
            get: {
                tags: ['Admin'],
                summary: 'Admin list transactions',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/transactions/flagged': {
            get: {
                tags: ['Admin'],
                summary: 'List flagged transactions',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/transactions/{transactionId}/review': {
            patch: {
                tags: ['Admin'],
                summary: 'Review flagged transaction',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/admin/audit-logs': {
            get: {
                tags: ['Admin'],
                summary: 'Get admin audit logs',
                security: [{ BearerAuth: [] }],
            },
        },

        '/api/v1/audit/logs': {
            get: {
                tags: ['Audit'],
                summary: 'List audit logs',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/audit/logs/{id}': {
            get: {
                tags: ['Audit'],
                summary: 'Get audit log by id',
                security: [{ BearerAuth: [] }],
            },
        },
        '/api/v1/audit/users/{userId}/logs': {
            get: {
                tags: ['Audit'],
                summary: 'Get audit logs for a user',
                security: [{ BearerAuth: [] }],
            },
        },
    },
};

const bodySchemaByOperation: Record<string, string> = {
    'POST /api/v1/auth/register': 'AuthRegisterRequest',
    'POST /api/v1/auth/login': 'AuthLoginRequest',
    'POST /api/v1/auth/refresh': 'AuthRefreshRequest',
    'POST /api/v1/users/email/verify': 'VerifyEmailRequest',
    'POST /api/v1/users/password/reset-initiate':
        'PasswordResetInitiateRequest',
    'POST /api/v1/users/password/reset-complete':
        'PasswordResetCompleteRequest',
    'PATCH /api/v1/users/me/password': 'ChangePasswordRequest',
    'PATCH /api/v1/users/me': 'UpdateProfileRequest',
    'POST /api/v1/users/2fa/enable': 'EnableTotpRequest',
    'POST /api/v1/users/2fa/confirm': 'ConfirmTotpRequest',
    'POST /api/v1/users/2fa/validate': 'ValidateTotpRequest',
    'POST /api/v1/users/2fa/disable': 'DisableTotpRequest',
    'POST /api/v1/users/kyc/submit': 'SubmitKycRequest',
    'PATCH /api/v1/users/{id}/kyc/reject': 'KycRejectRequest',
    'POST /api/v1/accounts': 'CreateAccountRequest',
    'PATCH /api/v1/accounts/{id}/status': 'UpdateAccountStatusRequest',
    'POST /api/v1/accounts/{accountId}/beneficiaries':
        'CreateBeneficiaryRequest',
    'POST /api/v1/accounts/{accountId}/standing-orders':
        'CreateStandingOrderRequest',
    'PUT /api/v1/accounts/{accountId}/preferences': 'UpdatePreferencesRequest',
    'POST /api/v1/accounts/{accountId}/limits': 'TransactionLimitsRequest',
    'POST /api/v1/accounts/{accountId}/alerts': 'CreateAlertRequest',
    'POST /api/v1/accounts/{accountId}/statements': 'GenerateStatementRequest',
    'POST /api/v1/transactions/transfer': 'TransferRequest',
    'POST /api/v1/transactions/deposit': 'DepositRequest',
    'POST /api/v1/transactions/withdrawal': 'WithdrawalRequest',
    'PATCH /api/v1/admin/users/{userId}/status': 'SetUserStatusRequest',
    'PATCH /api/v1/admin/transactions/{transactionId}/review':
        'ReviewFlaggedTransactionRequest',
};

const operationsWithoutBody = new Set<string>([
    'POST /api/v1/auth/logout',
    'POST /api/v1/users/email/resend-verification',
    'PATCH /api/v1/users/{id}/deactivate',
    'PATCH /api/v1/users/{id}/kyc/approve',
    'PATCH /api/v1/accounts/{accountId}/standing-orders/{orderId}/pause',
    'PATCH /api/v1/accounts/{accountId}/standing-orders/{orderId}/resume',
]);

const methodsWithBody = new Set(['post', 'put', 'patch']);

function extractPathParams(path: string): string[] {
    const matches = path.match(/\{([^}]+)\}/g) ?? [];
    return matches.map((match) => match.slice(1, -1));
}

function enhanceOpenApiSpec(spec: any): void {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        const pathParams = extractPathParams(path);

        for (const method of httpMethods) {
            const operation = (pathItem as any)[method];
            if (!operation) continue;

            if (pathParams.length > 0) {
                const existing = (operation.parameters ?? []) as Array<{
                    name: string;
                    in: string;
                }>;

                const existingPathParamNames = new Set(
                    existing
                        .filter((param) => param.in === 'path')
                        .map((param) => param.name),
                );

                operation.parameters = [
                    ...existing,
                    ...pathParams
                        .filter((name) => !existingPathParamNames.has(name))
                        .map((name) => ({
                            name,
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                            example: `${name}_example`,
                        })),
                ];
            }

            const operationKey = `${method.toUpperCase()} ${path}`;
            if (
                methodsWithBody.has(method) &&
                !operationsWithoutBody.has(operationKey) &&
                !operation.requestBody
            ) {
                const schemaName =
                    bodySchemaByOperation[operationKey] ?? 'GenericRequestBody';
                operation.requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: `#/components/schemas/${schemaName}`,
                            },
                        },
                    },
                };
            }
        }
    }
}

enhanceOpenApiSpec(openApiSpec);

export function setupSwagger(app: Express): void {
    app.get('/api-docs.json', (_req: Request, res: Response) => {
        res.json(openApiSpec);
    });

    app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(openApiSpec, {
            explorer: true,
            swaggerOptions: {
                persistAuthorization: true,
            },
        }),
    );
}
