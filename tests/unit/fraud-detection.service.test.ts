import { describe, it, expect } from 'vitest';
import { fraudDetectionService } from '../../src/modules/transactions/fraud-detection.service';
import { TransactionType } from '../../src/modules/transactions/transaction.types';

describe('fraudDetectionService.assessRisk', () => {
    it('returns LOW risk for small daytime deposit on mature account', () => {
        const result = fraudDetectionService.assessRisk({
            type: TransactionType.DEPOSIT,
            amount: 500,
            currency: 'GMD',
            occurredAt: new Date('2026-04-04T12:00:00Z'),
            toAccountCreatedAt: new Date('2025-01-01T12:00:00Z'),
        });

        expect(result.riskScore).toBe(0);
        expect(result.riskLevel).toBe('LOW');
        expect(result.isFlagged).toBe(false);
        expect(result.reasons).toEqual([]);
    });

    it('returns HIGH risk and flags a cross-user transfer off-hours with new accounts', () => {
        const result = fraudDetectionService.assessRisk({
            type: TransactionType.TRANSFER,
            amount: 20000,
            currency: 'GMD',
            occurredAt: new Date('2026-04-04T03:00:00Z'),
            isCrossUserTransfer: true,
            fromAccountCreatedAt: new Date('2026-04-01T00:00:00Z'),
            toAccountCreatedAt: new Date('2026-04-03T00:00:00Z'),
        });

        expect(result.riskScore).toBeGreaterThanOrEqual(70);
        expect(result.riskLevel).toBe('HIGH');
        expect(result.isFlagged).toBe(true);
        expect(result.reasons).toContain('Large transaction amount');
        expect(result.reasons).toContain('Transfer between different users');
        expect(result.reasons).toContain('Off-hours transaction');
    });

    it('returns HIGH risk for very large withdrawal with multiple risk factors', () => {
        const result = fraudDetectionService.assessRisk({
            type: TransactionType.WITHDRAWAL,
            amount: 50000,
            currency: 'GMD',
            occurredAt: new Date('2026-04-04T01:00:00Z'),
            fromAccountCreatedAt: new Date('2026-04-02T00:00:00Z'),
        });

        expect(result.riskScore).toBeGreaterThanOrEqual(70);
        expect(result.riskLevel).toBe('HIGH');
        expect(result.isFlagged).toBe(true);
        expect(result.reasons).toContain('Very large transaction amount');
        expect(result.reasons).toContain('Cash-out transaction type');
    });
});
