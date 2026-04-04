import { Queue, Worker, QueueEvents } from 'bullmq';
import { sendEmail } from './email.provider';
import { config } from '../../config';

/**
 * Email job payload types
 */
export interface EmailJob {
    type:
        | 'VERIFICATION'
        | 'PASSWORD_RESET'
        | '2FA_ENABLED'
        | '2FA_BACKUP'
        | 'ACCOUNT_LOCKED'
        | 'KYC_SUBMITTED'
        | 'KYC_APPROVED'
        | 'KYC_REJECTED'
        | 'TRANSACTION'
        | 'WELCOME';
    to: string;
    data: Record<string, any>;
}

/**
 * Redis connection configuration
 * Parses Redis URL and handles development and production scenarios
 */
function createRedisConnection() {
    const redisUrl = new URL(config.redis.url);

    const connection: {
        host: string;
        port: number;
        username?: string;
        password?: string;
        tls?: any;
    } = {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
    };

    if (redisUrl.username) {
        connection.username = redisUrl.username;
    }

    if (redisUrl.password) {
        connection.password = redisUrl.password;
    }

    if (redisUrl.protocol === 'rediss:') {
        connection.tls = {};
    }

    return connection;
}

const redisConnection = createRedisConnection();

/**
 * Email queue
 */
export const emailQueue = new Queue<EmailJob>('email', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

/**
 * Email queue events
 */
const queueEvents = new QueueEvents('email', {
    connection: redisConnection,
});

/**
 * Generate email template based on job type
 */
function generateEmailTemplate(job: EmailJob): {
    subject: string;
    html: string;
    text: string;
} {
    const { type, data } = job;

    switch (type) {
        case 'VERIFICATION':
            return {
                subject: 'Verify Your Email Address',
                html: `
                    <h2>Email Verification</h2>
                    <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
                    <p><a href="${data.verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                    <p>This link expires in ${data.expiresIn}.</p>
                    <p>If you didn't create this account, please ignore this email.</p>
                `,
                text: `Please verify your email by visiting: ${data.verificationUrl}\nThis link expires in ${data.expiresIn}.`,
            };

        case 'PASSWORD_RESET':
            return {
                subject: 'Reset Your Password',
                html: `
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password. Click the link below to create a new password:</p>
                    <p><a href="${data.resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                    <p>This link expires in ${data.expiresIn}.</p>
                    <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                `,
                text: `Reset your password here: ${data.resetUrl}\nThis link expires in ${data.expiresIn}.`,
            };

        case '2FA_ENABLED':
            return {
                subject: 'Two-Factor Authentication Enabled',
                html: `
                    <h2>2FA Enabled Successfully</h2>
                    <p>Two-factor authentication has been enabled on your account.</p>
                    <p>You will need to provide a 6-digit code from your authenticator app when signing in.</p>
                    <p>If you didn't enable this, please contact support immediately.</p>
                `,
                text: 'Two-factor authentication has been enabled on your account. You will need to provide a 6-digit code when signing in.',
            };

        case '2FA_BACKUP':
            return {
                subject: 'Your 2FA Backup Codes',
                html: `
                    <h2>2FA Backup Codes</h2>
                    <p>Save these backup codes in a safe place. You can use them to access your account if you lose access to your authenticator app:</p>
                    <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${data.backupCodes.join('\n')}</pre>
                    <p>Keep these codes confidential and in a secure location.</p>
                `,
                text: `Backup codes:\n${data.backupCodes.join('\n')}`,
            };

        case 'ACCOUNT_LOCKED':
            return {
                subject:
                    'Account Security Alert - Multiple Failed Login Attempts',
                html: `
                    <h2>Account Locked</h2>
                    <p>Your account has been locked due to multiple failed login attempts.</p>
                    <p>For your security, the account will automatically unlock after 30 minutes.</p>
                    <p>If this wasn't you, please reset your password immediately.</p>
                `,
                text: 'Your account has been locked due to multiple failed login attempts. It will unlock automatically after 30 minutes.',
            };

        case 'KYC_SUBMITTED':
            return {
                subject: 'KYC Verification Submitted',
                html: `
                    <h2>KYC Verification Submitted</h2>
                    <p>Thank you for submitting your Know Your Customer (KYC) verification documents.</p>
                    <p>We will review your information and get back to you within 2-3 business days.</p>
                    <p>Status: <strong>${data.status}</strong></p>
                `,
                text: `Your KYC verification has been submitted. Status: ${data.status}`,
            };

        case 'KYC_APPROVED':
            return {
                subject: 'KYC Verification Approved',
                html: `
                    <h2>KYC Verification Approved ✓</h2>
                    <p>Congratulations! Your KYC verification has been approved.</p>
                    <p>Account Tier: <strong>${data.accountTier}</strong></p>
                    <p>You now have access to all banking features.</p>
                `,
                text: `Your KYC verification has been approved. Account Tier: ${data.accountTier}`,
            };

        case 'KYC_REJECTED':
            return {
                subject: 'KYC Verification - Action Required',
                html: `
                    <h2>KYC Verification Not Approved</h2>
                    <p>Your KYC verification could not be approved.</p>
                    <p><strong>Reason:</strong> ${data.rejectionReason}</p>
                    <p>Please resubmit your documents or contact support for more information.</p>
                `,
                text: `Your KYC verification was not approved. Reason: ${data.rejectionReason}`,
            };

        case 'TRANSACTION':
            return {
                subject: `Transaction ${data.type} - ${data.reference}`,
                html: `
                    <h2>Transaction ${data.type}</h2>
                    <p><strong>Amount:</strong> ${data.currency} ${data.amount.toFixed(2)}</p>
                    <p><strong>Date:</strong> ${data.date}</p>
                    <p><strong>Reference:</strong> ${data.reference}</p>
                    <p><strong>Status:</strong> ${data.status}</p>
                `,
                text: `Transaction ${data.type}: ${data.currency} ${data.amount.toFixed(2)} - Reference: ${data.reference}`,
            };

        case 'WELCOME':
            return {
                subject: 'Welcome to Our Banking Platform',
                html: `
                    <h2>Welcome, ${data.fullName}!</h2>
                    <p>Your account has been created successfully.</p>
                    <p>You can now log in and start using our banking services.</p>
                    <p><a href="${data.loginUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a></p>
                `,
                text: `Welcome ${data.fullName}! You can now log in at ${data.loginUrl}`,
            };

        default:
            return {
                subject: 'Notification',
                html: '<p>Notification from our banking platform.</p>',
                text: 'Notification from our banking platform.',
            };
    }
}

/**
 * Email worker - processes email jobs
 */
const emailWorker = new Worker<EmailJob>(
    'email',
    async (job) => {
        const { to, data } = job.data;
        const template = generateEmailTemplate(job.data);

        try {
            await sendEmail({
                to,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });

            return { success: true, messageId: `email-${Date.now()}` };
        } catch (error) {
            throw new Error(
                `Failed to send email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    },
    {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 emails concurrently
    },
);

/**
 * Queue event handlers
 */
queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[EmailQueue] Job #${jobId} failed:`, failedReason);
});

queueEvents.on('completed', ({ jobId }) => {
    console.log(`[EmailQueue] Job #${jobId} completed`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job #${job?.id} failed:`, err.message);
});

emailWorker.on('completed', (job) => {
    console.log(`[EmailWorker] Job #${job.id} completed`);
});

/**
 * Cleanup function
 */
export async function closeEmailQueue(): Promise<void> {
    await emailWorker.close();
    await queueEvents.close();
    console.log('[EmailQueue] Queue and worker closed');
}

/**
 * Queue helper functions
 */

export async function queueVerificationEmail(
    email: string,
    fullName: string,
    verificationUrl: string,
    expiresIn: string,
): Promise<void> {
    await emailQueue.add('verification', {
        type: 'VERIFICATION',
        to: email,
        data: { fullName, verificationUrl, expiresIn },
    });
}

export async function queuePasswordResetEmail(
    email: string,
    resetUrl: string,
    expiresIn: string,
): Promise<void> {
    await emailQueue.add('password-reset', {
        type: 'PASSWORD_RESET',
        to: email,
        data: { resetUrl, expiresIn },
    });
}

export async function queue2FAEnabledEmail(email: string): Promise<void> {
    await emailQueue.add('2fa-enabled', {
        type: '2FA_ENABLED',
        to: email,
        data: {},
    });
}

export async function queue2FABackupCodesEmail(
    email: string,
    backupCodes: string[],
): Promise<void> {
    await emailQueue.add('2fa-backup', {
        type: '2FA_BACKUP',
        to: email,
        data: { backupCodes },
    });
}

export async function queueAccountLockedEmail(email: string): Promise<void> {
    await emailQueue.add('account-locked', {
        type: 'ACCOUNT_LOCKED',
        to: email,
        data: {},
    });
}

export async function queueKYCSubmittedEmail(
    email: string,
    status: string,
): Promise<void> {
    await emailQueue.add('kyc-submitted', {
        type: 'KYC_SUBMITTED',
        to: email,
        data: { status },
    });
}

export async function queueKYCApprovedEmail(
    email: string,
    accountTier: string,
): Promise<void> {
    await emailQueue.add('kyc-approved', {
        type: 'KYC_APPROVED',
        to: email,
        data: { accountTier },
    });
}

export async function queueKYCRejectedEmail(
    email: string,
    rejectionReason: string,
): Promise<void> {
    await emailQueue.add('kyc-rejected', {
        type: 'KYC_REJECTED',
        to: email,
        data: { rejectionReason },
    });
}

export async function queueTransactionEmail(
    email: string,
    type: string,
    amount: number,
    currency: string,
    reference: string,
    date: string,
    status: string,
): Promise<void> {
    await emailQueue.add('transaction', {
        type: 'TRANSACTION',
        to: email,
        data: { type, amount, currency, reference, date, status },
    });
}

export async function queueWelcomeEmail(
    email: string,
    fullName: string,
    loginUrl: string,
): Promise<void> {
    await emailQueue.add('welcome', {
        type: 'WELCOME',
        to: email,
        data: { fullName, loginUrl },
    });
}
