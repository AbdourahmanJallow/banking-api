import { z } from 'zod';

// ── Log-entry shape written by the service ─────────────────────────────────

export interface AuditEntry {
    userId?: string | null;
    action: string; // e.g. AUTH.LOGIN, TRANSACTION.TRANSFER
    resource?: string | null; // USER | ACCOUNT | TRANSACTION | AUTH
    resourceId?: string | null;
    method?: string | null;
    path?: string | null;
    statusCode?: number | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
}

// ── Query filters ─────────────────────────────────────────────────────────

export const AuditLogQuerySchema = z.object({
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
    resource: z.string().optional(),
    statusCode: z.coerce.number().int().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
