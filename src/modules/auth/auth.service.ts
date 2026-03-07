import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../config/connection';
import { config } from '../../config';
import { AppError } from '../../utils/AppError';
import {
    RegisterInput,
    LoginInput,
    TokenPair,
    AuthResponse,
} from './auth.types';

const SALT_ROUNDS = 12;

function generateTokens(userId: string, email: string): TokenPair {
    const accessToken = jwt.sign({ userId, email }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
    const refreshToken = jwt.sign({ userId, email }, config.jwt.secret, {
        expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
    return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
        where: { email: input.email },
    });
    if (existing)
        throw AppError.conflict('Email already in use', 'EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: {
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone,
        },
    });

    const tokens = generateTokens(user.id, user.email);
    return {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        tokens,
    };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
    });
    if (!user) throw AppError.unauthorized('Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw AppError.unauthorized('Invalid email or password');

    if (user.status !== 'ACTIVE')
        throw AppError.forbidden('Account is suspended', 'ACCOUNT_SUSPENDED');

    const tokens = generateTokens(user.id, user.email);
    return {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        tokens,
    };
}

export async function refreshToken(token: string): Promise<TokenPair> {
    let payload: { userId: string; email: string };
    try {
        payload = jwt.verify(token, config.jwt.secret) as typeof payload;
    } catch {
        throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
    });
    if (!user || user.status !== 'ACTIVE')
        throw AppError.unauthorized('User not found or inactive');

    return generateTokens(user.id, user.email);
}
