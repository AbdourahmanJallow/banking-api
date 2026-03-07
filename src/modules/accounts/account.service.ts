import { accountRepository } from './account.repository';
import { CreateAccountInput, UpdateAccountStatusInput } from './account.types';
import { generateAccountNumber } from '../../utils/generateAccountNumber';
import { AppError } from '../../utils/AppError';

class AccountService {
    async createAccount(userId: string, input: CreateAccountInput) {
        // Generate a unique account number (retry on collision)
        let accountNumber: string;
        let attempts = 0;
        do {
            accountNumber = generateAccountNumber();

            const existing =
                await accountRepository.findByAccountNumber(accountNumber);

            if (!existing) break;

            attempts++;
        } while (attempts < 3);

        return accountRepository.create(userId, input.currency, accountNumber!);
    }

    async getAccount(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return account;
    }

    async getUserAccounts(userId: string) {
        return accountRepository.findByUserId(userId);
    }

    async updateAccountStatus(
        accountId: string,
        input: UpdateAccountStatusInput,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return accountRepository.updateStatus(accountId, input.status);
    }
}

export const accountService = new AccountService();
