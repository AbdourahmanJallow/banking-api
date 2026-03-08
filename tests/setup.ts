import { vi } from 'vitest';

// Silence console output during tests unless DEBUG=true
if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
}
