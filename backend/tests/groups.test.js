import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery } from './setup.js';
import app from '../src/app.js';
import { generateTestToken, testUser, testUser2, testGroupId } from './helpers/testUtils.js';

describe('Group Endpoints', () => {
  const token = generateTestToken(testUser);
  const token2 = generateTestToken(testUser2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/groups', () => {
    it('should create a group (201)', async () => {
      // client.query('BEGIN')
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // client.query('INSERT INTO groups ...')
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testGroupId,
            name: 'Trip to Goa',
            description: 'Goa vacation',
            created_by: testUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
      // client.query('INSERT INTO group_members ...')
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // client.query('COMMIT')
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Trip to Goa',
          description: 'Goa vacation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testGroupId);
      expect(res.body.data.name).toBe('Trip to Goa');
      expect(res.body.data.createdBy).toBe(testUser.id);
    });

    it('should return 400 for invalid group data (missing name)', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'No name group',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/groups', () => {
    it("should list user's groups (200)", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testGroupId,
            name: 'Trip to Goa',
            description: 'Goa vacation',
            createdBy: testUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userRole: 'creator',
            memberCount: 2,
          },
        ],
      });

      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(testGroupId);
    });
  });

  describe('GET /api/groups/:groupId', () => {
    it('should get group details (200)', async () => {
      // Middleware requireGroupMember:
      // 1. Check group exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      // 2. Check user is active member
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            group_id: testGroupId,
            user_id: testUser.id,
            role: 'creator',
            status: 'active',
          },
        ],
      });
      // Controller getGroupById:
      // 3. Get group info with creator details
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testGroupId,
            name: 'Trip to Goa',
            description: 'Goa vacation',
            createdBy: testUser.id,
            creatorName: testUser.name,
            creatorEmail: testUser.email,
            memberCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testGroupId);
      expect(res.body.data.name).toBe('Trip to Goa');
      expect(res.body.data.creator.email).toBe(testUser.email);
    });

    it('should prevent non-member from accessing group (403)', async () => {
      // Middleware requireGroupMember:
      // 1. Check group exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      // 2. Check membership -> not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not an active member');
    });

    it('should return 404 if group does not exist', async () => {
      // Middleware requireGroupMember:
      // 1. Check group exists -> not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Group not found');
    });
  });

  describe('POST /api/groups/:groupId/members', () => {
    it('should add a member by email (201)', async () => {
      // Middleware requireGroupCreator:
      // 1. Check group exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      // 2. Check user is creator
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            group_id: testGroupId,
            user_id: testUser.id,
            role: 'creator',
            status: 'active',
          },
        ],
      });
      // Service addMember:
      // 3. Find user by email
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
          },
        ],
      });
      // 4. Check if member already in group
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 5. Insert new member
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-2',
            group_id: testGroupId,
            user_id: testUser2.id,
            role: 'member',
            status: 'active',
            joined_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: testUser2.email });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(testUser2.id);
      expect(res.body.data.role).toBe('member');
    });

    it('should return error adding non-existent email (404)', async () => {
      // Middleware requireGroupCreator:
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            group_id: testGroupId,
            user_id: testUser.id,
            role: 'creator',
            status: 'active',
          },
        ],
      });
      // Service addMember: find user by email -> not found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'unknown@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should return error adding existing member (409)', async () => {
      // Middleware requireGroupCreator:
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            group_id: testGroupId,
            user_id: testUser.id,
            role: 'creator',
            status: 'active',
          },
        ],
      });
      // Service addMember:
      // User found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testUser2.id, name: testUser2.name, email: testUser2.email }],
      });
      // Member already active in group
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'gm-uuid-2', status: 'active', role: 'member' }],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: testUser2.email });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already an active member');
    });

    it('should prevent non-creator from adding members (403)', async () => {
      // Middleware requireGroupCreator:
      // Group exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      // User is active member, but role is 'member', NOT 'creator'
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-2',
            group_id: testGroupId,
            user_id: testUser2.id,
            role: 'member',
            status: 'active',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ email: 'newperson@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('creator');
    });
  });

  describe('GET /api/groups/:groupId/members', () => {
    it('should list group members (200)', async () => {
      // Middleware requireGroupMember:
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: testGroupId, created_by: testUser.id }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            group_id: testGroupId,
            user_id: testUser.id,
            role: 'creator',
            status: 'active',
          },
        ],
      });
      // Service getGroupMembers:
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'gm-uuid-1',
            userId: testUser.id,
            name: testUser.name,
            email: testUser.email,
            role: 'creator',
            status: 'active',
            joinedAt: new Date().toISOString(),
          },
          {
            id: 'gm-uuid-2',
            userId: testUser2.id,
            name: testUser2.name,
            email: testUser2.email,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get(`/api/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].userId).toBe(testUser.id);
      expect(res.body.data[1].userId).toBe(testUser2.id);
    });
  });
});
