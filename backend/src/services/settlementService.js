import db from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { isValidUUID } from '../utils/helpers.js';
import { getSettlementSuggestions } from './balanceService.js';

/**
 * Format a settlement database row into an API object
 * with both flat (snake_case and camelCase) and nested user objects
 */
export const formatSettlement = (row) => ({
  id: row.id,
  groupId: row.group_id,
  group_id: row.group_id,
  payerId: row.payer_id,
  payer_id: row.payer_id,
  payerName: row.payer_name,
  payer_name: row.payer_name,
  payer: {
    id: row.payer_id,
    name: row.payer_name,
    email: row.payer_email,
  },
  receiverId: row.receiver_id,
  receiver_id: row.receiver_id,
  receiverName: row.receiver_name,
  receiver_name: row.receiver_name,
  receiver: {
    id: row.receiver_id,
    name: row.receiver_name,
    email: row.receiver_email,
  },
  amount: row.amount,
  status: row.status,
  createdBy: row.created_by,
  created_by: row.created_by,
  creatorName: row.creator_name,
  creator_name: row.creator_name,
  creator: {
    id: row.created_by,
    name: row.creator_name,
    email: row.creator_email,
  },
  createdAt: row.created_at,
  created_at: row.created_at,
  updatedAt: row.updated_at,
  updated_at: row.updated_at,
});

/**
 * Create a new settlement record
 */
export const createSettlement = async (groupId, { payerId, receiverId, amount }, createdBy) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  if (!payerId || !isValidUUID(payerId)) {
    throw new BadRequestError('Invalid payer ID');
  }

  if (!receiverId || !isValidUUID(receiverId)) {
    throw new BadRequestError('Invalid receiver ID');
  }

  if (payerId === receiverId) {
    throw new BadRequestError('Payer and receiver cannot be the same user');
  }

  const parsedAmount = Math.round(Number(amount));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new BadRequestError('Settlement amount must be a positive integer in paise');
  }

  // Validate both are active group members
  const membersResult = await db.query(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id IN ($2, $3) AND status = 'active'`,
    [groupId, payerId, receiverId]
  );

  if (membersResult.rows.length !== 2) {
    throw new BadRequestError('Both payer and receiver must be active members of the group');
  }

  // Validate that the creator is either the payer or the receiver
  if (createdBy !== payerId && createdBy !== receiverId) {
    throw new ForbiddenError('Only the payer or receiver can initiate a settlement request');
  }

  // Live pairwise debt verification: payer must owe money to receiver
  const { suggestions } = await getSettlementSuggestions(groupId);
  const pairwiseDebt = suggestions.find(
    (s) =>
      ((s.from?.userId || s.fromUserId) === payerId) &&
      ((s.to?.userId || s.toUserId) === receiverId)
  );
  const maxDebt = pairwiseDebt ? pairwiseDebt.amount : 0;

  if (maxDebt <= 0) {
    throw new BadRequestError('Payer does not owe any money to this receiver');
  }

  if (parsedAmount > maxDebt) {
    throw new BadRequestError(
      `Settlement amount (₹${(parsedAmount / 100).toFixed(2)}) cannot exceed the current debt of ₹${(maxDebt / 100).toFixed(2)}`
    );
  }

  // Insert settlement with status='pending'
  const insertResult = await db.query(
    `INSERT INTO settlements (group_id, payer_id, receiver_id, amount, status, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [groupId, payerId, receiverId, parsedAmount, createdBy]
  );

  const settlementId = insertResult.rows[0].id;

  // Fetch full details
  const detailResult = await db.query(
    `SELECT s.*,
            p.name as payer_name, p.email as payer_email,
            r.name as receiver_name, r.email as receiver_email,
            c.name as creator_name, c.email as creator_email
     FROM settlements s
     JOIN users p ON p.id = s.payer_id
     JOIN users r ON r.id = s.receiver_id
     JOIN users c ON c.id = s.created_by
     WHERE s.id = $1`,
    [settlementId]
  );

  return formatSettlement(detailResult.rows[0]);
};

/**
 * Get all settlements for a group
 */
export const getGroupSettlements = async (groupId) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  const result = await db.query(
    `SELECT s.*,
            p.name as payer_name, p.email as payer_email,
            r.name as receiver_name, r.email as receiver_email,
            c.name as creator_name, c.email as creator_email
     FROM settlements s
     JOIN users p ON p.id = s.payer_id
     JOIN users r ON r.id = s.receiver_id
     JOIN users c ON c.id = s.created_by
     WHERE s.group_id = $1
     ORDER BY s.created_at DESC`,
    [groupId]
  );

  return result.rows.map(formatSettlement);
};

/**
 * Update settlement status (completed or cancelled)
 */
export const updateSettlement = async (settlementId, status, userId) => {
  if (!settlementId || !isValidUUID(settlementId)) {
    throw new BadRequestError('Invalid settlement ID');
  }

  if (!['completed', 'cancelled'].includes(status)) {
    throw new BadRequestError("Status must be 'completed' or 'cancelled'");
  }

  // Find settlement and group creator
  const settlementResult = await db.query(
    `SELECT s.*, g.created_by as group_creator_id
     FROM settlements s
     JOIN groups g ON g.id = s.group_id
     WHERE s.id = $1`,
    [settlementId]
  );

  if (settlementResult.rows.length === 0) {
    throw new NotFoundError('Settlement not found');
  }

  const settlement = settlementResult.rows[0];

  // Must be pending to be updated
  if (settlement.status !== 'pending') {
    throw new BadRequestError(`Settlement is already ${settlement.status}`);
  }

  const isPayer = userId === settlement.payer_id;
  const isReceiver = userId === settlement.receiver_id;
  const isGroupCreator = userId === settlement.group_creator_id;

  // Authorization: only payer, receiver, or group creator can update
  if (!isPayer && !isReceiver && !isGroupCreator) {
    throw new ForbiddenError('You are not authorized to update this settlement');
  }

  // For 'completed': ONLY the receiver can confirm/accept
  if (status === 'completed' && !isReceiver) {
    throw new ForbiddenError('Only the recipient can confirm and complete a settlement');
  }

  // For 'cancelled': payer, receiver, or creator can cancel (already satisfied by auth check)

  await db.query(
    `UPDATE settlements
     SET status = $1, updated_at = NOW()
     WHERE id = $2`,
    [status, settlementId]
  );

  // Fetch updated details
  const detailResult = await db.query(
    `SELECT s.*,
            p.name as payer_name, p.email as payer_email,
            r.name as receiver_name, r.email as receiver_email,
            c.name as creator_name, c.email as creator_email
     FROM settlements s
     JOIN users p ON p.id = s.payer_id
     JOIN users r ON r.id = s.receiver_id
     JOIN users c ON c.id = s.created_by
     WHERE s.id = $1`,
    [settlementId]
  );

  return formatSettlement(detailResult.rows[0]);
};
