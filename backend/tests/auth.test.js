import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery } from './setup.js';
import app from '../src/app.js';
import bcrypt from 'bcrypt';
import { generateTestToken, testUser } from './helpers/testUtils.js';

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully (201)', async () => {
      // 1. Check existing email -> not found
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 2. Insert new user -> returns new user record
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user.id).toBe(testUser.id);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.name).toBe('Test User');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should return error for duplicate email (409)', async () => {
      // Check existing email -> found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-uuid', email: 'test@example.com' }],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    it('should return validation error for missing fields (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should return validation error for invalid email (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return validation error for short password (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should not return password_hash in response', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            password_hash: 'secret_hash',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('secret_hash');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials (200)', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.id).toBe(testUser.id);
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should return error for wrong password (401)', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should return error for non-existent email (401)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should return a valid JWT token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      const token = res.body.data.token;
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated (200)', async () => {
      const token = generateTestToken(testUser);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testUser.id);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.name).toBe(testUser.name);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
