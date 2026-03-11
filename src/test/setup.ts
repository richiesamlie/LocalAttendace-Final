import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global fetch for Zustand state tests hitting API endpoints
global.fetch = vi.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);
