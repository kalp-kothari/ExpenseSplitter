import db from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { isValidUUID } from '../utils/helpers.js';

export const requireGroupMember = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const groupId = req.params.groupId || req.params.id;
    if (!groupId || !isValidUUID(groupId)) {
      throw new BadRequestError('Invalid group ID');
    }

    const groupResult = await db.query('SELECT id, created_by FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      throw new NotFoundError('Group not found');
    }

    const memberResult = await db.query(
      'SELECT id, group_id, user_id, role, status FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (memberResult.rows.length === 0 || memberResult.rows[0].status !== 'active') {
      throw new ForbiddenError('You are not an active member of this group');
    }

    req.groupMember = memberResult.rows[0];
    req.group = groupResult.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

export const requireGroupCreator = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const groupId = req.params.groupId || req.params.id;
    if (!groupId || !isValidUUID(groupId)) {
      throw new BadRequestError('Invalid group ID');
    }

    const groupResult = await db.query('SELECT id, created_by FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      throw new NotFoundError('Group not found');
    }

    const memberResult = await db.query(
      'SELECT id, group_id, user_id, role, status FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (memberResult.rows.length === 0 || memberResult.rows[0].status !== 'active') {
      throw new ForbiddenError('You are not an active member of this group');
    }

    if (memberResult.rows[0].role !== 'creator') {
      throw new ForbiddenError('Only the group creator can perform this action');
    }

    req.groupMember = memberResult.rows[0];
    req.group = groupResult.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};
