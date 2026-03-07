import { config } from '../../config';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Minimal email provider backed by Resend.
 * RESEND_API_KEY is optional — if absent, emails are logged to console in dev.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
    if (!config.email.apiKey) {
        console.log('[Email - dev mode]', options.subject, '->', options.to);
        return;
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.email.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'no-reply@banking.local',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error('[Email] Failed to send:', body);
    }
}
