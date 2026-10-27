import db from '../config/database.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import { calculateUserBalance } from './groupService.js';

/**
 * Format database row to leave request object
 * @param {object} row 
 * @returns {object}
 */
const formatLeaveRequest = (row) => ({
  id: row.id,
  groupId: row.group_id || row.groupId,
  userId: row.user_id || row.userId,
  status: row.status,
  reason: row.reason,
  adminNote: row.admin_note || row.adminNote,
  balanceSnapshot: parseInt(row.balance_snapshot ?? row.balanceSnapshot ?? 0, 10),
  createdAt: row.created_at || row.createdAt,
  updatedAt: row.updated_at || row.updatedAt,
  ...(row.userName && { userName: row.userName }),
  ...(row.userEmail && { userEmail: row.userEmail }),
});

/**
 * Create a leave request for a group member
 * @param {string} groupId 
 * @param {string} userId 
 * @param {string} [reason] 
 * @returns {Promise<object>}
 */
export const createLeaveRequest = async (groupId, userId, reason) => {
  // Check membership
  const memberResult = await db.query(
    'SELECT id, role, status FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );

  if (memberResult.rows.length === 0 || memberResult.rows[0].status !== 'active') {
    throw new BadRequestError('User is not an active member of this group');
  }

  if (memberResult.rows[0].role === 'creator') {
    throw new BadRequestError('Group creator cannot leave the group');
  }

  // Check for existing pending request
  const pendingResult = await db.query(
    "SELECT id FROM leave_requests WHERE group_id = $1 AND user_id = $2 AND status = 'pending'",
    [groupId, userId]
  );

  if (pendingResult.rows.length > 0) {
    throw new ConflictError('A pending leave request already exists for this group');
  }

  // Calculate user's current net balance
  const balance = await calculateUserBalance(groupId, userId, db);

  // If balance is 0: auto-approve immediately
  if (balance === 0) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const insertResult = await client.query(
        `INSERT INTO leave_requests (group_id, user_id, status, reason, admin_note, balance_snapshot)
         VALUES ($1, $2, 'approved', $3, 'Auto-approved (zero balance)', 0)
         RETURNING id, group_id, user_id, status, reason, admin_note, balance_snapshot, created_at, updated_at`,
        [groupId, userId, reason ? reason.trim() : null]
      );

      await client.query(
        `UPDATE group_members
         SET status = 'left'
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );

      await client.query('COMMIT');
      return formatLeaveRequest(insertResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Non-zero balance requires creator review
  const insertResult = await db.query(
    `INSERT INTO leave_requests (group_id, user_id, status, reason, balance_snapshot)
     VALUES ($1, $2, 'pending', $3, $4)
     RETURNING id, group_id, user_id, status, reason, admin_note, balance_snapshot, created_at, updated_at`,
    [groupId, userId, reason ? reason.trim() : null, balance]
  );

  return formatLeaveRequest(insertResult.rows[0]);
};

/**
 * Get all leave requests for a group
 * @param {string} groupId 
 * @returns {Promise<Array<object>>}
 */
export const getGroupLeaveRequests = async (groupId) => {
  const result = await db.query(
    `SELECT 
      lr.id,
      lr.group_id AS "groupId",
      lr.user_id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      lr.status,
      lr.reason,
      lr.admin_note AS "adminNote",
      lr.balance_snapshot AS "balanceSnapshot",
      lr.created_at AS "createdAt",
      lr.updated_at AS "updatedAt"
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.group_id = $1
    ORDER BY lr.created_at DESC`,
    [groupId]
  );

  return result.rows.map((row) => ({
    ...row,
    balanceSnapshot: parseInt(row.balanceSnapshot, 10),
  }));
};

/**
 * Approve or reject a leave request
 * @param {string} requestId 
 * @param {'approved' | 'rejected'} status 
 * @param {string} [adminNote] 
 * @param {string} decidedByUserId 
 * @returns {Promise<object>}
 */
export const updateLeaveRequest = async (requestId, status, adminNote, decidedByUserId) => {
  if (status !== 'approved' && status !== 'rejected') {
    throw new BadRequestError('Invalid status. Status must be either approved or rejected.');
  }

  // Find leave request with group creator info
  const result = await db.query(
    `SELECT lr.*, g.created_by
     FROM leave_requests lr
     JOIN groups g ON g.id = lr.group_id
     WHERE lr.id = $1`,
    [requestId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Leave request not found');
  }

  const lr = result.rows[0];

  if (lr.status !== 'pending') {
    throw new BadRequestError('Leave request has already been decided');
  }

  // Creator check
  if (lr.created_by !== decidedByUserId) {
    throw new ForbiddenError('Only the group creator can approve or reject leave requests');
  }

  if (status === 'approved') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Update leave request
      const updateResult = await client.query(
        `UPDATE leave_requests
         SET status = 'approved', admin_note = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, group_id, user_id, status, reason, admin_note, balance_snapshot, created_at, updated_at`,
        [adminNote ? adminNote.trim() : null, requestId]
      );

      // Update member status to 'left'
      await client.query(
        `UPDATE group_members
         SET status = 'left'
         WHERE group_id = $1 AND user_id = $2`,
        [lr.group_id, lr.user_id]
      );

      // If balance_snapshot != 0, redistribute debt via a completed settlement with the creator
      const balanceSnapshot = parseInt(lr.balance_snapshot, 10);
      if (balanceSnapshot !== 0) {
        // If balance_snapshot > 0 (user is owed money): creator pays user
        // If balance_snapshot < 0 (user owes money): user pays creator
        const payerId = balanceSnapshot > 0 ? lr.created_by : lr.user_id;
        const receiverId = balanceSnapshot > 0 ? lr.user_id : lr.created_by;
        const amount = Math.abs(balanceSnapshot);

        await client.query(
          `INSERT INTO settlements (group_id, payer_id, receiver_id, amount, status, created_by)
           VALUES ($1, $2, $3, $4, 'completed', $5)`,
          [lr.group_id, payerId, receiverId, amount, decidedByUserId]
        );
      }

      await client.query('COMMIT');
      return formatLeaveRequest(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Rejection branch
  const updateResult = await db.query(
    `UPDATE leave_requests
     SET status = 'rejected', admin_note = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, group_id, user_id, status, reason, admin_note, balance_snapshot, created_at, updated_at`,
    [adminNote ? adminNote.trim() : null, requestId]
  );

  return formatLeaveRequest(updateResult.rows[0]);
};
