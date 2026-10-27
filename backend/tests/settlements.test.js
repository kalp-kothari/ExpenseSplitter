import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery } from './setup.js';
import app from '../src/app.js';
import { generateTestToken, testUser, testUser2, testGroupId, testSettlementId } from './helpers/testUtils.js';

const token = generateTestToken(testUser);
const token2 = generateTestToken(testUser2);

// Helper to mock group member check (used by requireGroupMember middleware)
const mockGroupMemberCheck = (userId = testUser.id, role = 'member') => {
  // Query 1: Check group exists
  mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId, created_by: testUser.id }] });
  // Query 2: Check user is active member
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'member-1', group_id: testGroupId, user_id: userId, role, status: 'active' }],
  });
};

// Helper to mock queries performed inside getGroupBalances(groupId)
const mockGroupBalancesQueries = (balances, totalExpenses = 10000) => {
  // Query A: Check group exists
  mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
  // Query B: Total expenses
  mockQuery.mockResolvedValueOnce({ rows: [{ total_expenses: String(totalExpenses) }] });
  // Query C: CTE balances query
  mockQuery.mockResolvedValueOnce({ rows: balances });
};

describe('Settlement Endpoints', () => {
  describe('POST /api/groups/:groupId/settlements', () => {
    it('should create a settlement successfully (201)', async () => {
      mockGroupMemberCheck(testUser.id, 'member');

      // Service: validate payer & receiver are active members
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      });

      // Service: getGroupBalances queries (groupCheck, totalExpenses, CTE)
      mockGroupBalancesQueries([
        {
          user_id: testUser.id, name: testUser.name, email: testUser.email,
          total_paid: '0', total_owed: '5000', settled_paid: '0', settled_received: '0', net_balance: '-5000',
        },
        {
          user_id: testUser2.id, name: testUser2.name, email: testUser2.email,
          total_paid: '10000', total_owed: '5000', settled_paid: '0', settled_received: '0', net_balance: '5000',
        },
      ]);

      // Service: insert settlement
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testSettlementId }],
      });

      // Service: fetch full settlement details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, payer_name: testUser.name, payer_email: testUser.email,
          receiver_id: testUser2.id, receiver_name: testUser2.name, receiver_email: testUser2.email,
          amount: 3000, status: 'pending', created_by: testUser.id,
          creator_name: testUser.name, creator_email: testUser.email,
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          payerId: testUser.id,
          receiverId: testUser2.id,
          amount: 3000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testSettlementId);
      expect(res.body.data.amount).toBe(3000);
      expect(res.body.data.status).toBe('pending');
    });

    it('should reject self-settlement (400)', async () => {
      mockGroupMemberCheck(testUser.id, 'member');

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          payerId: testUser.id,
          receiverId: testUser.id,
          amount: 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject settlement where payer does not owe money (400)', async () => {
      mockGroupMemberCheck(testUser.id, 'member');

      // Active members check
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      });

      // Balance query: payer has POSITIVE balance (doesn't owe money)
      mockGroupBalancesQueries([
        {
          user_id: testUser.id, name: testUser.name, email: testUser.email,
          total_paid: '10000', total_owed: '5000', settled_paid: '0', settled_received: '0', net_balance: '5000',
        },
        {
          user_id: testUser2.id, name: testUser2.name, email: testUser2.email,
          total_paid: '0', total_owed: '5000', settled_paid: '0', settled_received: '0', net_balance: '-5000',
        },
      ]);

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          payerId: testUser.id,
          receiverId: testUser2.id,
          amount: 3000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('does not owe');
    });

    it('should reject settlement exceeding outstanding debt (400)', async () => {
      mockGroupMemberCheck(testUser.id, 'member');

      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      });

      mockGroupBalancesQueries([
        {
          user_id: testUser.id, name: testUser.name, email: testUser.email,
          total_paid: '0', total_owed: '2000', settled_paid: '0', settled_received: '0', net_balance: '-2000',
        },
        {
          user_id: testUser2.id, name: testUser2.name, email: testUser2.email,
          total_paid: '4000', total_owed: '2000', settled_paid: '0', settled_received: '0', net_balance: '2000',
        },
      ]);

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          payerId: testUser.id,
          receiverId: testUser2.id,
          amount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot exceed');
    });
  });

  describe('GET /api/groups/:groupId/settlements', () => {
    it('should list group settlements (200)', async () => {
      mockGroupMemberCheck(testUser.id, 'member');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testSettlementId, group_id: testGroupId,
            payer_id: testUser.id, payer_name: testUser.name, payer_email: testUser.email,
            receiver_id: testUser2.id, receiver_name: testUser2.name, receiver_email: testUser2.email,
            amount: 5000, status: 'pending',
            created_by: testUser.id, creator_name: testUser.name, creator_email: testUser.email,
            created_at: new Date(), updated_at: new Date(),
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/settlements`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(testSettlementId);
    });
  });

  describe('PATCH /api/settlements/:settlementId', () => {
    it('should mark settlement as completed (200)', async () => {
      // Find settlement with group creator
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, receiver_id: testUser2.id,
          amount: 5000, status: 'pending',
          created_by: testUser.id, group_creator_id: testUser.id,
        }],
      });

      // Update query
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      // Fetch updated details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, payer_name: testUser.name, payer_email: testUser.email,
          receiver_id: testUser2.id, receiver_name: testUser2.name, receiver_email: testUser2.email,
          amount: 5000, status: 'completed',
          created_by: testUser.id, creator_name: testUser.name, creator_email: testUser.email,
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .patch(`/api/settlements/${testSettlementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('should cancel a pending settlement (200)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, receiver_id: testUser2.id,
          amount: 5000, status: 'pending',
          created_by: testUser.id, group_creator_id: testUser.id,
        }],
      });

      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, payer_name: testUser.name, payer_email: testUser.email,
          receiver_id: testUser2.id, receiver_name: testUser2.name, receiver_email: testUser2.email,
          amount: 5000, status: 'cancelled',
          created_by: testUser.id, creator_name: testUser.name, creator_email: testUser.email,
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .patch(`/api/settlements/${testSettlementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should reject updating a non-pending settlement (400)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, receiver_id: testUser2.id,
          amount: 5000, status: 'completed',
          created_by: testUser.id, group_creator_id: testUser.id,
        }],
      });

      const res = await request(app)
        .patch(`/api/settlements/${testSettlementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already');
    });

    it('should reject unauthorized settlement update (403)', async () => {
      const otherUserId = 'deadbeef-dead-beef-dead-beefdeadbeef';
      const otherToken = generateTestToken({ id: otherUserId, name: 'Other', email: 'other@example.com' });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testSettlementId, group_id: testGroupId,
          payer_id: testUser.id, receiver_id: testUser2.id,
          amount: 5000, status: 'pending',
          created_by: testUser.id, group_creator_id: testUser.id,
        }],
      });

      const res = await request(app)
        .patch(`/api/settlements/${testSettlementId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent settlement', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/api/settlements/${testSettlementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
