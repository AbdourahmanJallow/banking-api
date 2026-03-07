/**
 * Generates a unique 16-digit account number in the format:
 * YYYYMMDD + 8 random digits
 */
export function generateAccountNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(
        10_000_000 + Math.random() * 90_000_000,
    ).toString();
    return `${datePart}${randomPart}`;
}
