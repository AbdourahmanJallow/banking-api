import { sendEmail } from './email.provider';

export async function sendWelcomeEmail(
    to: string,
    fullName: string,
): Promise<void> {
    await sendEmail({
        to,
        subject: 'Welcome to Banking API',
        html: `<h1>Welcome, ${fullName}!</h1><p>Your account has been created successfully.</p>`,
        text: `Welcome, ${fullName}! Your account has been created successfully.`,
    });
}

export async function sendTransactionNotification(
    to: string,
    type: string,
    amount: number,
    currency: string,
    reference: string,
): Promise<void> {
    await sendEmail({
        to,
        subject: `Transaction ${type} - ${reference}`,
        html: `<p>Your <strong>${type}</strong> of <strong>${currency} ${amount.toFixed(2)}</strong> was processed. Reference: ${reference}</p>`,
        text: `Your ${type} of ${currency} ${amount.toFixed(2)} was processed. Reference: ${reference}`,
    });
}

export async function sendPasswordChangedEmail(to: string): Promise<void> {
    await sendEmail({
        to,
        subject: 'Password Changed',
        html: '<p>Your password has been changed. If this was not you, contact support immediately.</p>',
        text: 'Your password has been changed. If this was not you, contact support immediately.',
    });
}
