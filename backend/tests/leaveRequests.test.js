import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery, mockConnect, mockRelease } from './setup.js';
import app from '../src/app.js';
import { generateTestToken, testUser, testUser2, testGroupId, testRequestId } from './helpers/testUtils.js';

const token = generateTestToken(testUser);
const creatorToken = generateTestToken(testUser);

// Mock the group membership middleware queries
const mockGroupMemberCheck = (userId = testUser.id, role = 'member') => {
  // Query 1: group exists
  mockQuery.mockResolvedValueOnce({ rows: [{ id: testGroupId }] });
  // Query 2: active member
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'member-1', group_id: testGroupId, user_id: userId, role, status: 'active' }],
  });
};

describe('Leave Request Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/groups/:groupId/leave-requests', () => {
    it('should create a leave request when balance is non-zero (201, pending)', async () => {
      mockGroupMemberCheck(testUser2.id, 'member');
      const token2 = generateTestToken(testUser2);

      // Service: check membership
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'member-2', role: 'member', status: 'active' }],
      });

      // Service: check pending requests
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Service: calculateUserBalance — paid
      mockQuery.mockResolvedValueOnce({ rows: [{ total_paid: '0' }] });
      // Service: calculateUserBalance — owed
      mockQuery.mockResolvedValueOnce({ rows: [{ total_owed: '5000' }] });
      // Service: calculateUserBalance — settled paid
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // Service: calculateUserBalance — settled received
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });

      // Service: insert leave_request (non-zero balance → pending)
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'pending',
          reason: 'Need to leave',
          admin_note: null,
          balance_snapshot: -5000,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/leave-requests`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ reason: 'Need to leave' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.balanceSnapshot).toBe(-5000);
    });

    it('should auto-approve when balance is zero (201, approved)', async () => {
      mockGroupMemberCheck(testUser2.id, 'member');
      const token2 = generateTestToken(testUser2);

      // Service: check membership
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'member-2', role: 'member', status: 'active' }],
      });

      // Service: check pending requests
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Service: calculateUserBalance — all zero
      mockQuery.mockResolvedValueOnce({ rows: [{ total_paid: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_owed: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });

      // Service: transaction — connect
      const mockClientQuery = vi.fn();
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({});
      // Insert leave_request with status='approved'
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'approved',
          reason: null,
          admin_note: 'Auto-approved (zero balance)',
          balance_snapshot: 0,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });
      // Update group_members status='left'
      mockClientQuery.mockResolvedValueOnce({ rowCount: 1 });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({});

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/leave-requests`)
        .set('Authorization', `Bearer ${token2}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.balanceSnapshot).toBe(0);
    });

    it('should reject duplicate pending request (409)', async () => {
      mockGroupMemberCheck(testUser2.id, 'member');
      const token2 = generateTestToken(testUser2);

      // Service: check membership
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'member-2', role: 'member', status: 'active' }],
      });

      // Service: check pending requests → found one
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testRequestId }],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/leave-requests`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ reason: 'Trying again' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('pending');
    });

    it('should reject leave request from group creator (400)', async () => {
      mockGroupMemberCheck(testUser.id, 'creator');

      // Service: check membership — creator role
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'member-1', role: 'creator', status: 'active' }],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/leave-requests`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Creator leaving' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('creator');
    });
  });

  describe('GET /api/groups/:groupId/leave-requests', () => {
    it('should list group leave requests (200)', async () => {
      mockGroupMemberCheck(testUser.id, 'creator');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testRequestId,
            groupId: testGroupId,
            userId: testUser2.id,
            userName: testUser2.name,
            userEmail: testUser2.email,
            status: 'pending',
            reason: 'Need to leave',
            adminNote: null,
            balanceSnapshot: '-5000',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/leave-requests`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('PATCH /api/leave-requests/:requestId', () => {
    it('should approve leave request with balance redistribution (200)', async () => {
      // Service: find leave request with group creator
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'pending',
          reason: 'Need to leave',
          balance_snapshot: -3000,
          created_by: testUser.id,
        }],
      });

      // Service: transaction
      const mockClientQuery = vi.fn();
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({});
      // Update leave_request
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'approved',
          reason: 'Need to leave',
          admin_note: 'Approved with debt redistribution',
          balance_snapshot: -3000,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });
      // Update group_members
      mockClientQuery.mockResolvedValueOnce({ rowCount: 1 });
      // Insert settlement for balance redistribution
      mockClientQuery.mockResolvedValueOnce({ rowCount: 1 });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({});

      const res = await request(app)
        .patch(`/api/leave-requests/${testRequestId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'approved', adminNote: 'Approved with debt redistribution' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
    });

    it('should reject leave request (200)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'pending',
          reason: 'Need to leave',
          balance_snapshot: -3000,
          created_by: testUser.id,
        }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'rejected',
          reason: 'Need to leave',
          admin_note: 'Please settle debts first',
          balance_snapshot: -3000,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .patch(`/api/leave-requests/${testRequestId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'rejected', adminNote: 'Please settle debts first' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });

    it('should prevent non-creator from approving (403)', async () => {
      const nonCreatorToken = generateTestToken({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Nobody', email: 'nobody@example.com' });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'pending',
          reason: 'Need to leave',
          balance_snapshot: -3000,
          created_by: testUser.id,
        }],
      });

      const res = await request(app)
        .patch(`/api/leave-requests/${testRequestId}`)
        .set('Authorization', `Bearer ${nonCreatorToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject updating already decided request (400)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: testRequestId,
          group_id: testGroupId,
          user_id: testUser2.id,
          status: 'approved',
          balance_snapshot: 0,
          created_by: testUser.id,
        }],
      });

      const res = await request(app)
        .patch(`/api/leave-requests/${testRequestId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already');
    });

    it('should return 404 for non-existent request', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/api/leave-requests/${testRequestId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
