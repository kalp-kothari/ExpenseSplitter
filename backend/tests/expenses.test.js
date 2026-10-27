import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery } from './setup.js';
import app from '../src/app.js';
import { generateTestToken, testUser, testUser2, testUser3, testGroupId, testExpenseId } from './helpers/testUtils.js';

describe('Expense Endpoints', () => {
  const token = generateTestToken(testUser);
  const token2 = generateTestToken(testUser2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGroupMemberAccess = (groupId = testGroupId, userId = testUser.id, role = 'creator') => {
    // 1. requireGroupMember: Check group exists
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: groupId, created_by: userId }],
    });
    // 2. requireGroupMember: Check user is active member
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'gm-uuid-1', group_id: groupId, user_id: userId, role, status: 'active' }],
    });
  };

  describe('POST /api/groups/:groupId/expenses', () => {
    it('should create an expense with equal split (201)', async () => {
      mockGroupMemberAccess();

      // client.query('BEGIN')
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // validate payers
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] });
      // validate splits
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      });
      // insert expense
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Dinner',
            description: 'Team dinner',
            total_amount: 2000,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      // insert payer (1 payer)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // insert split 1
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // insert split 2
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // payers query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'p-1',
            user_id: testUser.id,
            amount: 2000,
            name: testUser.name,
            email: testUser.email,
          },
        ],
      });
      // splits query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 's-1',
            user_id: testUser.id,
            amount: 1000,
            percentage: null,
            name: testUser.name,
            email: testUser.email,
          },
          {
            id: 's-2',
            user_id: testUser2.id,
            amount: 1000,
            percentage: null,
            name: testUser2.name,
            email: testUser2.email,
          },
        ],
      });
      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Dinner',
          description: 'Team dinner',
          totalAmount: 2000,
          splitType: 'equal',
          payers: [{ userId: testUser.id, amount: 2000 }],
          splits: [{ userId: testUser.id }, { userId: testUser2.id }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testExpenseId);
      expect(res.body.data.totalAmount).toBe(2000);
      expect(res.body.data.splitType).toBe('equal');
      expect(res.body.data.payers).toHaveLength(1);
      expect(res.body.data.splits).toHaveLength(2);
      expect(res.body.data.splits[0].amount).toBe(1000);
      expect(res.body.data.splits[1].amount).toBe(1000);
    });

    it('should handle uneven equal split (remainder distribution)', async () => {
      mockGroupMemberAccess();

      // total 100 paise across 3 participants: 34 + 33 + 33 = 100
      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers valid
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }, { user_id: testUser3.id }],
      }); // splits valid
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Coffee',
            description: null,
            total_amount: 100,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 1 (34)
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 2 (33)
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 3 (33)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 100, name: testUser.name, email: testUser.email }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 's-1', user_id: testUser.id, amount: 34, percentage: null, name: testUser.name, email: testUser.email },
          { id: 's-2', user_id: testUser2.id, amount: 33, percentage: null, name: testUser2.name, email: testUser2.email },
          { id: 's-3', user_id: testUser3.id, amount: 33, percentage: null, name: testUser3.name, email: testUser3.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Coffee',
          totalAmount: 100,
          splitType: 'equal',
          payers: [{ userId: testUser.id, amount: 100 }],
          splits: [{ userId: testUser.id }, { userId: testUser2.id }, { userId: testUser3.id }],
        });

      expect(res.status).toBe(201);
      const splitSum = res.body.data.splits.reduce((sum, s) => sum + s.amount, 0);
      expect(splitSum).toBe(100);
      expect(res.body.data.splits[0].amount).toBe(34);
    });

    it('should create an expense with exact split (201)', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Groceries',
            total_amount: 5000,
            split_type: 'exact',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 1
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 2
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 5000, name: testUser.name, email: testUser.email }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 's-1', user_id: testUser.id, amount: 3000, percentage: null, name: testUser.name, email: testUser.email },
          { id: 's-2', user_id: testUser2.id, amount: 2000, percentage: null, name: testUser2.name, email: testUser2.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Groceries',
          totalAmount: 5000,
          splitType: 'exact',
          payers: [{ userId: testUser.id, amount: 5000 }],
          splits: [
            { userId: testUser.id, amount: 3000 },
            { userId: testUser2.id, amount: 2000 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.splitType).toBe('exact');
    });

    it("should reject exact split where amounts don't sum to total (400)", async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers valid
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits valid
      mockQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Groceries',
          totalAmount: 5000,
          splitType: 'exact',
          payers: [{ userId: testUser.id, amount: 5000 }],
          splits: [
            { userId: testUser.id, amount: 2000 },
            { userId: testUser2.id, amount: 2000 }, // sum 4000 != 5000
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('sum to total amount');
    });

    it('should create an expense with percentage split (201)', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Party',
            total_amount: 10000,
            split_type: 'percentage',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 1
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 2
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 10000, name: testUser.name, email: testUser.email }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 's-1', user_id: testUser.id, amount: 6000, percentage: '60.000', name: testUser.name, email: testUser.email },
          { id: 's-2', user_id: testUser2.id, amount: 4000, percentage: '40.000', name: testUser2.name, email: testUser2.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Party',
          totalAmount: 10000,
          splitType: 'percentage',
          payers: [{ userId: testUser.id, amount: 10000 }],
          splits: [
            { userId: testUser.id, percentage: 60 },
            { userId: testUser2.id, percentage: 40 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.splitType).toBe('percentage');
    });

    it('should reject percentage split not summing to 100 (400)', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers valid
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits valid
      mockQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Party',
          totalAmount: 10000,
          splitType: 'percentage',
          payers: [{ userId: testUser.id, amount: 10000 }],
          splits: [
            { userId: testUser.id, percentage: 50 },
            { userId: testUser2.id, percentage: 40 }, // sum 90 != 100
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Percentages must sum to 100');
    });

    it('should handle percentage split rounding correctly', async () => {
      mockGroupMemberAccess();

      // total 100 paise, split 33.333% and 66.667% = 100%
      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Split round',
            total_amount: 100,
            split_type: 'percentage',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 1
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 2
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 100, name: testUser.name, email: testUser.email }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 's-1', user_id: testUser.id, amount: 33, percentage: '33.333', name: testUser.name, email: testUser.email },
          { id: 's-2', user_id: testUser2.id, amount: 67, percentage: '66.667', name: testUser2.name, email: testUser2.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Split round',
          totalAmount: 100,
          splitType: 'percentage',
          payers: [{ userId: testUser.id, amount: 100 }],
          splits: [
            { userId: testUser.id, percentage: 33.333 },
            { userId: testUser2.id, percentage: 66.667 },
          ],
        });

      expect(res.status).toBe(201);
      const sum = res.body.data.splits.reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBe(100);
    });

    it('should support multiple payers (201)', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: testUser.id }, { user_id: testUser2.id }],
      }); // splits
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Hotel',
            total_amount: 10000,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer 1
      mockQuery.mockResolvedValueOnce({ rows: [] }); // payer 2
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 1
      mockQuery.mockResolvedValueOnce({ rows: [] }); // split 2
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'p-1', user_id: testUser.id, amount: 6000, name: testUser.name, email: testUser.email },
          { id: 'p-2', user_id: testUser2.id, amount: 4000, name: testUser2.name, email: testUser2.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 's-1', user_id: testUser.id, amount: 5000, percentage: null, name: testUser.name, email: testUser.email },
          { id: 's-2', user_id: testUser2.id, amount: 5000, percentage: null, name: testUser2.name, email: testUser2.email },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Hotel',
          totalAmount: 10000,
          splitType: 'equal',
          payers: [
            { userId: testUser.id, amount: 6000 },
            { userId: testUser2.id, amount: 4000 },
          ],
          splits: [{ userId: testUser.id }, { userId: testUser2.id }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payers).toHaveLength(2);
    });

    it("should reject if payer amounts don't sum to total (400)", async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // payers valid
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] }); // splits valid
      mockQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Mismatch',
          totalAmount: 5000,
          splitType: 'equal',
          payers: [{ userId: testUser.id, amount: 4000 }], // 4000 != 5000
          splits: [{ userId: testUser.id }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Payer amounts must sum to total amount');
    });

    it('should reject negative amounts (400)', async () => {
      mockGroupMemberAccess();

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Negative',
          totalAmount: -500,
          splitType: 'equal',
          payers: [{ userId: testUser.id, amount: -500 }],
          splits: [{ userId: testUser.id }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-member participants (400)', async () => {
      mockGroupMemberAccess();

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      // Payers valid
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] });
      // Splits membership check: returns only 1 member instead of 2
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUser.id }] });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'With non member',
          totalAmount: 1000,
          splitType: 'equal',
          payers: [{ userId: testUser.id, amount: 1000 }],
          splits: [{ userId: testUser.id }, { userId: testUser2.id }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active members');
    });
  });

  describe('GET /api/groups/:groupId/expenses', () => {
    it('should get group expenses (200)', async () => {
      mockGroupMemberAccess();

      // expenses query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Dinner',
            description: null,
            total_amount: 2000,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            creator_name: testUser.name,
            creator_email: testUser.email,
          },
        ],
      });
      // payers query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', expense_id: testExpenseId, user_id: testUser.id, amount: 2000, name: testUser.name, email: testUser.email }],
      });
      // splits query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 's-1', expense_id: testExpenseId, user_id: testUser.id, amount: 2000, percentage: null, name: testUser.name, email: testUser.email }],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/expenses`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(testExpenseId);
    });
  });

  describe('GET /api/expenses/:expenseId', () => {
    it('should get individual expense details (200)', async () => {
      // 1. expense check
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Dinner',
            description: null,
            total_amount: 2000,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            creator_name: testUser.name,
            creator_email: testUser.email,
          },
        ],
      });
      // 2. group member check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'gm-1', role: 'member', status: 'active' }],
      });
      // 3. payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 2000, name: testUser.name, email: testUser.email }],
      });
      // 4. splits
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 's-1', user_id: testUser.id, amount: 2000, percentage: null, name: testUser.name, email: testUser.email }],
      });

      const res = await request(app)
        .get(`/api/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testExpenseId);
    });
  });

  describe('PATCH /api/expenses/:expenseId', () => {
    it('should update an expense (200)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // expense query (created_by is testUser.id)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Old Title',
            description: null,
            total_amount: 2000,
            split_type: 'equal',
            created_by: testUser.id,
            group_creator_id: testUser.id,
          },
        ],
      });
      // update query
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // getExpenseById calls:
      // expense query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'New Title',
            description: 'Updated desc',
            total_amount: 2000,
            split_type: 'equal',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            creator_name: testUser.name,
            creator_email: testUser.email,
          },
        ],
      });
      // member check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'gm-1', role: 'creator', status: 'active' }],
      });
      // payers
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p-1', user_id: testUser.id, amount: 2000, name: testUser.name, email: testUser.email }],
      });
      // splits
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 's-1', user_id: testUser.id, amount: 2000, percentage: null, name: testUser.name, email: testUser.email }],
      });

      const res = await request(app)
        .patch(`/api/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'New Title',
          description: 'Updated desc',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Title');
    });

    it('should prevent unauthorized expense modification (403)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // expense was created by testUser, group creator is testUser
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            title: 'Old Title',
            created_by: testUser.id,
            group_creator_id: testUser.id,
          },
        ],
      });
      // ROLLBACK
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Request made by testUser2 (not expense creator and not group creator)
      const res = await request(app)
        .patch(`/api/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Only the expense creator or group creator');
    });
  });

  describe('DELETE /api/expenses/:expenseId', () => {
    it('should delete an expense (200)', async () => {
      // Find expense and creator
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testExpenseId,
            group_id: testGroupId,
            created_by: testUser.id,
            group_creator_id: testUser.id,
          },
        ],
      });
      // Delete query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete(`/api/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
