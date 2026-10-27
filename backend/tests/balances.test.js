import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery } from './setup.js';
import app from '../src/app.js';
import { generateTestToken, testUser, testUser2, testUser3, testGroupId } from './helpers/testUtils.js';

describe('Balance Endpoints & Calculations', () => {
  const token = generateTestToken(testUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGroupMemberAccess = () => {
    // 1. requireGroupMember: Check group exists
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: testGroupId, created_by: testUser.id }],
    });
    // 2. requireGroupMember: Check user is active member
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'gm-uuid-1', group_id: testGroupId, user_id: testUser.id, role: 'creator', status: 'active' }],
    });
  };

  describe('GET /api/groups/:groupId/balances', () => {
    it('should calculate correct balances for simple expense', async () => {
      mockGroupMemberAccess();

      // balanceService.getGroupBalances:
      // 1. Group check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      // 2. Total expenses
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 3000 }] });
      // 3. Balances CTE query (User 1 paid 3000, owes 1500 -> net +1500; User 2 paid 0, owes 1500 -> net -1500)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 3000,
            total_owed: 1500,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 1500,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 0,
            total_owed: 1500,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -1500,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balances).toHaveLength(2);

      const u1 = res.body.data.balances.find((b) => b.userId === testUser.id);
      const u2 = res.body.data.balances.find((b) => b.userId === testUser2.id);

      expect(u1.netBalance).toBe(1500);
      expect(u2.netBalance).toBe(-1500);
      expect(res.body.data.summary.totalExpenses).toBe(3000);
    });

    it('should calculate balances with multiple payers', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 6000 }] });
      // Expense total 6000, split equally between 3 (2000 each)
      // User 1 paid 4000 (net: +2000)
      // User 2 paid 2000 (net: 0)
      // User 3 paid 0 (net: -2000)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 4000,
            total_owed: 2000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 2000,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 2000,
            total_owed: 2000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 0,
          },
          {
            user_id: testUser3.id,
            name: testUser3.name,
            email: testUser3.email,
            total_paid: 0,
            total_owed: 2000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -2000,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.balances).toHaveLength(3);
      const u1 = res.body.data.balances.find((b) => b.userId === testUser.id);
      const u2 = res.body.data.balances.find((b) => b.userId === testUser2.id);
      const u3 = res.body.data.balances.find((b) => b.userId === testUser3.id);

      expect(u1.netBalance).toBe(2000);
      expect(u2.netBalance).toBe(0);
      expect(u3.netBalance).toBe(-2000);
    });

    it('should include completed settlements in balance', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 2000 }] });
      // User 1 paid 2000, owed 1000. User 2 paid 0, owed 1000.
      // User 2 settled 1000 to User 1 (completed).
      // User 1: 2000 - 1000 + 0 - 1000 = 0
      // User 2: 0 - 1000 + 1000 - 0 = 0
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 2000,
            total_owed: 1000,
            settled_paid: 0,
            settled_received: 1000,
            net_balance: 0,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 0,
            total_owed: 1000,
            settled_paid: 1000,
            settled_received: 0,
            net_balance: 0,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const u1 = res.body.data.balances.find((b) => b.userId === testUser.id);
      const u2 = res.body.data.balances.find((b) => b.userId === testUser2.id);
      expect(u1.settledReceived).toBe(1000);
      expect(u2.settledPaid).toBe(1000);
      expect(u1.netBalance).toBe(0);
      expect(u2.netBalance).toBe(0);
    });

    it('should return zero-sum balances across group', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 9000 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 6000,
            total_owed: 3000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 3000,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 2000,
            total_owed: 3000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -1000,
          },
          {
            user_id: testUser3.id,
            name: testUser3.name,
            email: testUser3.email,
            total_paid: 1000,
            total_owed: 3000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -2000,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sum = res.body.data.balances.reduce((acc, b) => acc + b.netBalance, 0);
      expect(sum).toBe(0);
    });
  });

  describe('GET /api/groups/:groupId/settlements/suggestions', () => {
    it('should generate settlement suggestions', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 2000 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 2000,
            total_owed: 1000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 1000,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 0,
            total_owed: 1000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -1000,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/settlements/suggestions`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.suggestions).toHaveLength(1);
      expect(res.body.data.suggestions[0].from.userId).toBe(testUser2.id);
      expect(res.body.data.suggestions[0].to.userId).toBe(testUser.id);
      expect(res.body.data.suggestions[0].amount).toBe(1000);
    });

    it('should minimize number of suggested transactions', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: 9000 }] });
      // 3 members:
      // User 1 owes 3000
      // User 2 owes 1000
      // User 3 is owed 4000
      // Greedy approach:
      // Transfer 1: User 1 -> User 3 (3000)
      // Transfer 2: User 2 -> User 3 (1000)
      // Total transactions = 2
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            total_paid: 0,
            total_owed: 3000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -3000,
          },
          {
            user_id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            total_paid: 0,
            total_owed: 1000,
            settled_paid: 0,
            settled_received: 0,
            net_balance: -1000,
          },
          {
            user_id: testUser3.id,
            name: testUser3.name,
            email: testUser3.email,
            total_paid: 4000,
            total_owed: 0,
            settled_paid: 0,
            settled_received: 0,
            net_balance: 4000,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/settlements/suggestions`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toHaveLength(2);
      expect(res.body.data.totalTransactions).toBe(2);

      const totalTransferred = res.body.data.suggestions.reduce((sum, s) => sum + s.amount, 0);
      expect(totalTransferred).toBe(4000);
    });
  });
});
