import jwt from 'jsonwebtoken';

export const generateTestToken = (user = {}) => {
  const payload = {
    id: user.id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: user.email || 'test@example.com',
    name: user.name || 'Test User',
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key-for-testing', { expiresIn: '1h' });
};

export const testUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Test User',
  email: 'test@example.com',
};

export const testUser2 = {
  id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  name: 'Test User 2',
  email: 'test2@example.com',
};

export const testUser3 = {
  id: 'c3d4e5f6-a7b8-9012-bcde-f12345678902',
  name: 'Test User 3',
  email: 'test3@example.com',
};

export const testGroupId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
export const testExpenseId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
export const testSettlementId = 'e5f6a7b8-c9d0-1234-efab-345678901234';
export const testRequestId = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
