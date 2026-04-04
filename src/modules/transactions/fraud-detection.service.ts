import { TransactionType } from './transaction.types';

interface RiskContext {
    type: TransactionType;
    amount: number;
    currency: string;
    occurredAt?: Date;
    fromAccountCreatedAt?: Date;
    toAccountCreatedAt?: Date;
    isCrossUserTransfer?: boolean;
}

export interface FraudAssessment {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    isFlagged: boolean;
    reasons: string[];
}

class FraudDetectionService {
    assessRisk(context: RiskContext): FraudAssessment {
        const reasons: string[] = [];
        let riskScore = 0;

        if (context.amount >= 50000) {
            riskScore += 45;
            reasons.push('Very large transaction amount');
        } else if (context.amount >= 20000) {
            riskScore += 30;
            reasons.push('Large transaction amount');
        } else if (context.amount >= 10000) {
            riskScore += 15;
            reasons.push('Above-average transaction amount');
        }

        if (context.type === TransactionType.WITHDRAWAL) {
            riskScore += 15;
            reasons.push('Cash-out transaction type');
        }

        if (
            context.type === TransactionType.TRANSFER &&
            context.isCrossUserTransfer
        ) {
            riskScore += 20;
            reasons.push('Transfer between different users');
        }

        const eventTime = context.occurredAt ?? new Date();
        const hour = eventTime.getHours();
        if (hour <= 5) {
            riskScore += 10;
            reasons.push('Off-hours transaction');
        }

        const now = eventTime.getTime();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

        if (context.fromAccountCreatedAt) {
            const age = now - new Date(context.fromAccountCreatedAt).getTime();
            if (age < sevenDaysInMs) {
                riskScore += 15;
                reasons.push('Source account is newly created');
            }
        }

        if (context.toAccountCreatedAt) {
            const age = now - new Date(context.toAccountCreatedAt).getTime();
            if (age < sevenDaysInMs) {
                riskScore += 10;
                reasons.push('Destination account is newly created');
            }
        }

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (riskScore >= 70) {
            riskLevel = 'HIGH';
        } else if (riskScore >= 40) {
            riskLevel = 'MEDIUM';
        }

        return {
            riskScore,
            riskLevel,
            isFlagged: riskScore >= 40,
            reasons,
        };
    }
}

export const fraudDetectionService = new FraudDetectionService();
