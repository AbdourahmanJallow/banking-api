import * as AccountRepository from './account.repository';
import { CreateAccountInput, UpdateAccountStatusInput } from './account.types';
import { generateAccountNumber } from '../../utils/generateAccountNumber';
import { AppError } from '../../utils/AppError';

export async function createAccount(userId: string, input: CreateAccountInput) {
    // Generate a unique account number (retry on collision)
    let accountNumber: string;
    let attempts = 0;
    do {
        accountNumber = generateAccountNumber();
        const existing =
            await AccountRepository.findByAccountNumber(accountNumber);
        if (!existing) break;
        attempts++;
    } while (attempts < 5);

    return AccountRepository.create(userId, input.currency, accountNumber!);
}

export async function getAccount(accountId: string, requestingUserId: string) {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw AppError.notFound('Account not found');
    if (account.userId !== requestingUserId)
        throw AppError.forbidden('Access denied');
    return account;
}

export async function getUserAccounts(userId: string) {
    return AccountRepository.findByUserId(userId);
}

export async function updateAccountStatus(
    accountId: string,
    input: UpdateAccountStatusInput,
    requestingUserId: string,
) {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw AppError.notFound('Account not found');
    if (account.userId !== requestingUserId)
        throw AppError.forbidden('Access denied');
    return AccountRepository.updateStatus(accountId, input.status);
}
