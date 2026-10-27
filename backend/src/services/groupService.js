import db from '../config/database.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';

/**
 * Calculate the net balance of a user within a group
 * @param {string} groupId 
 * @param {string} userId 
 * @param {object} [client=db] Optional client for transactions
 * @returns {Promise<number>} Net balance in paise
 */
export const calculateUserBalance = async (groupId, userId, client = db) => {
  const paidResult = await client.query(
    `SELECT COALESCE(SUM(ep.amount), 0)::bigint as total_paid
     FROM expense_payers ep
     JOIN expenses e ON e.id = ep.expense_id
     WHERE e.group_id = $1 AND ep.user_id = $2`,
    [groupId, userId]
  );

  const owedResult = await client.query(
    `SELECT COALESCE(SUM(es.amount), 0)::bigint as total_owed
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1 AND es.user_id = $2`,
    [groupId, userId]
  );

  const settledPaidResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::bigint as total FROM settlements
     WHERE group_id = $1 AND payer_id = $2 AND status = 'completed'`,
    [groupId, userId]
  );

  const settledReceivedResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::bigint as total FROM settlements
     WHERE group_id = $1 AND receiver_id = $2 AND status = 'completed'`,
    [groupId, userId]
  );

  const totalPaid = parseInt(paidResult.rows[0].total_paid, 10);
  const totalOwed = parseInt(owedResult.rows[0].total_owed, 10);
  const totalSettledPaid = parseInt(settledPaidResult.rows[0].total, 10);
  const totalSettledReceived = parseInt(settledReceivedResult.rows[0].total, 10);

  return totalPaid - totalOwed + totalSettledPaid - totalSettledReceived;
};

/**
 * Create a new group with the creator as initial active member
 * @param {string} name 
 * @param {string} [description] 
 * @param {string} userId 
 * @returns {Promise<object>}
 */
export const createGroup = async (name, description, userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const groupResult = await client.query(
      `INSERT INTO groups (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at, updated_at`,
      [name.trim(), description ? description.trim() : null, userId]
    );

    const group = groupResult.rows[0];

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role, status)
       VALUES ($1, $2, 'creator', 'active')`,
      [group.id, userId]
    );

    await client.query('COMMIT');

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdBy: group.created_by,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      memberCount: 1,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get all groups where the user is an active member
 * @param {string} userId 
 * @returns {Promise<Array<object>>}
 */
export const getUserGroups = async (userId) => {
  const result = await db.query(
    `SELECT 
      g.id,
      g.name,
      g.description,
      g.created_by AS "createdBy",
      g.created_at AS "createdAt",
      g.updated_at AS "updatedAt",
      gm.role AS "userRole",
      (
        SELECT COUNT(*)::int 
        FROM group_members m 
        WHERE m.group_id = g.id AND m.status = 'active'
      ) AS "memberCount"
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = $1 AND gm.status = 'active'
    ORDER BY g.created_at DESC`,
    [userId]
  );

  return result.rows;
};

/**
 * Get group details by ID
 * @param {string} groupId 
 * @returns {Promise<object>}
 */
export const getGroupById = async (groupId) => {
  const result = await db.query(
    `SELECT 
      g.id,
      g.name,
      g.description,
      g.created_by AS "createdBy",
      u.name AS "creatorName",
      u.email AS "creatorEmail",
      g.created_at AS "createdAt",
      g.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int 
        FROM group_members gm 
        WHERE gm.group_id = g.id AND gm.status = 'active'
      ) AS "memberCount"
    FROM groups g
    JOIN users u ON g.created_by = u.id
    WHERE g.id = $1`,
    [groupId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Group not found');
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.createdBy,
    creator: {
      id: row.createdBy,
      name: row.creatorName,
      email: row.creatorEmail,
    },
    memberCount: row.memberCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Add a member to a group by user email
 * @param {string} groupId 
 * @param {string} email 
 * @param {string} addedByUserId 
 * @returns {Promise<object>}
 */
export const addMember = async (groupId, email, addedByUserId) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const userResult = await db.query(
    'SELECT id, name, email FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User with this email not found');
  }

  const user = userResult.rows[0];

  // Check if member already exists in this group
  const memberResult = await db.query(
    'SELECT id, status, role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, user.id]
  );

  let member;

  if (memberResult.rows.length > 0) {
    const existingMember = memberResult.rows[0];
    if (existingMember.status === 'active') {
      throw new ConflictError('User is already an active member of this group');
    }

    // Reactivate previously inactive/left member
    const updateResult = await db.query(
      `UPDATE group_members
       SET status = 'active', joined_at = NOW()
       WHERE group_id = $1 AND user_id = $2
       RETURNING id, group_id, user_id, role, status, joined_at`,
      [groupId, user.id]
    );
    member = updateResult.rows[0];
  } else {
    // Insert new member
    const insertResult = await db.query(
      `INSERT INTO group_members (group_id, user_id, role, status)
       VALUES ($1, $2, 'member', 'active')
       RETURNING id, group_id, user_id, role, status, joined_at`,
      [groupId, user.id]
    );
    member = insertResult.rows[0];
  }

  return {
    id: member.id,
    groupId: member.group_id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: member.role,
    status: member.status,
    joinedAt: member.joined_at,
  };
};

/**
 * Get all active members of a group
 * @param {string} groupId 
 * @returns {Promise<Array<object>>}
 */
export const getGroupMembers = async (groupId) => {
  const result = await db.query(
    `SELECT 
      gm.id,
      gm.user_id AS "userId",
      u.name,
      u.email,
      gm.role,
      gm.status,
      gm.joined_at AS "joinedAt"
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = $1 AND gm.status = 'active'
    ORDER BY 
      CASE WHEN gm.role = 'creator' THEN 1 WHEN gm.role = 'admin' THEN 2 ELSE 3 END,
      u.name ASC`,
    [groupId]
  );

  return result.rows;
};

/**
 * Remove an active member from a group (by group creator)
 * @param {string} groupId 
 * @param {string} memberId group_members.id
 * @param {string} removedByUserId 
 * @returns {Promise<object>}
 */
export const removeMember = async (groupId, memberId, removedByUserId) => {
  // Find member record
  const memberResult = await db.query(
    'SELECT id, group_id, user_id, role, status FROM group_members WHERE id = $1 AND group_id = $2',
    [memberId, groupId]
  );

  if (memberResult.rows.length === 0) {
    throw new NotFoundError('Member not found in this group');
  }

  const member = memberResult.rows[0];

  if (member.status !== 'active') {
    throw new BadRequestError('Member is not active in this group');
  }

  if (member.role === 'creator') {
    throw new BadRequestError('Cannot remove the group creator');
  }

  if (member.user_id === removedByUserId) {
    throw new BadRequestError('Cannot remove yourself. Use leave request instead.');
  }

  // Calculate member's balance
  const balance = await calculateUserBalance(groupId, member.user_id, db);

  if (balance !== 0) {
    throw new BadRequestError('Cannot remove member with outstanding balance. Use leave request instead.');
  }

  // Mark status as 'left'
  const updateResult = await db.query(
    `UPDATE group_members
     SET status = 'left'
     WHERE id = $1
     RETURNING id, group_id, user_id, role, status`,
    [memberId]
  );

  return {
    id: updateResult.rows[0].id,
    userId: updateResult.rows[0].user_id,
    groupId: updateResult.rows[0].group_id,
    status: updateResult.rows[0].status,
  };
};
