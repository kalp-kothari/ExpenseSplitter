import { vi, beforeEach } from 'vitest';

// Set test environment variables before module imports
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Must mock before any imports that use the database
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});

vi.mock('../src/config/database.js', () => ({
  default: {
    query: mockQuery,
    connect: mockConnect,
    end: vi.fn(),
  },
}));

export const resetMocks = () => {
  mockQuery.mockReset();
  mockRelease.mockReset();
  mockConnect.mockReset().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
};

beforeEach(() => {
  resetMocks();
});

export { mockQuery, mockConnect, mockRelease };

