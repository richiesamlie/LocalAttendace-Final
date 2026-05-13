import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Ensure required auth env exists in test runtime before modules initialize DB schema.
process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

// Mock global fetch for Zustand state tests hitting API endpoints
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);
