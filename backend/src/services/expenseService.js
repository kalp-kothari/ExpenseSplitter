import db from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { isValidUUID } from '../utils/helpers.js';

/**
 * Helper to calculate split amounts based on splitType
 */
const calculateSplits = (splitType, splits, totalAmount) => {
  if (!splits || !Array.isArray(splits) || splits.length === 0) {
    throw new BadRequestError('At least one split participant is required');
  }

  if (splitType === 'equal') {
    const count = splits.length;
    const baseAmount = Math.floor(totalAmount / count);
    const remainder = totalAmount % count;
    return splits.map((s, i) => ({
      userId: s.userId,
      amount: baseAmount + (i < remainder ? 1 : 0),
      percentage: null,
    }));
  }

  if (splitType === 'exact') {
    if (splits.some((s) => typeof s.amount !== 'number' || s.amount <= 0 || !Number.isInteger(s.amount))) {
      throw new BadRequestError('All split amounts must be positive');
    }
    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    if (splitTotal !== totalAmount) {
      throw new BadRequestError('Split amounts must sum to total amount');
    }
    return splits.map((s) => ({
      userId: s.userId,
      amount: s.amount,
      percentage: null,
    }));
  }

  if (splitType === 'percentage') {
    if (splits.some((s) => typeof s.percentage !== 'number' || s.percentage <= 0)) {
      throw new BadRequestError('All percentages must be positive');
    }
    const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPercentage - 100) >= 0.01) {
      throw new BadRequestError('Percentages must sum to 100');
    }

    const rawAmounts = splits.map((s) => ({ ...s, raw: (totalAmount * s.percentage) / 100 }));
    const floorAmounts = rawAmounts.map((s) => ({
      ...s,
      floor: Math.floor(s.raw),
      frac: s.raw - Math.floor(s.raw),
    }));
    const floorTotal = floorAmounts.reduce((sum, s) => sum + s.floor, 0);
    const remainder = totalAmount - floorTotal;
    floorAmounts.sort((a, b) => b.frac - a.frac);

    return floorAmounts.map((s, i) => ({
      userId: s.userId,
      amount: s.floor + (i < remainder ? 1 : 0),
      percentage: s.percentage,
    }));
  }

  throw new BadRequestError(`Invalid split type: ${splitType}`);
};

/**
 * Validate active group members for an array of user IDs
 */
const validateGroupMembers = async (client, groupId, userIds, roleName) => {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length !== userIds.length) {
    throw new BadRequestError(`Duplicate user found in ${roleName}`);
  }

  const memberResult = await client.query(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::uuid[]) AND status = 'active'`,
    [groupId, uniqueIds]
  );

  if (memberResult.rows.length !== uniqueIds.length) {
    throw new BadRequestError(`All ${roleName} must be active members of the group`);
  }
};

/**
 * Create a new expense with payers and splits inside a database transaction
 */
export const createExpense = async (
  groupId,
  { title, description, totalAmount, splitType, payers, splits },
  createdBy
) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new BadRequestError('Title is required');
  }

  if (typeof totalAmount !== 'number' || totalAmount <= 0 || !Number.isInteger(totalAmount)) {
    throw new BadRequestError('Total amount must be a positive integer in paise');
  }

  if (!['equal', 'exact', 'percentage'].includes(splitType)) {
    throw new BadRequestError("Split type must be 'equal', 'exact', or 'percentage'");
  }

  if (!payers || !Array.isArray(payers) || payers.length === 0) {
    throw new BadRequestError('At least one payer is required');
  }

  if (!splits || !Array.isArray(splits) || splits.length === 0) {
    throw new BadRequestError('At least one split participant is required');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate all payers are active group members
    const payerUserIds = payers.map((p) => p.userId);
    await validateGroupMembers(client, groupId, payerUserIds, 'payers');

    // 2. Validate all split participants are active group members
    const splitUserIds = splits.map((s) => s.userId);
    await validateGroupMembers(client, groupId, splitUserIds, 'split participants');

    // 3. Validate payer amounts sum to totalAmount
    for (const p of payers) {
      if (typeof p.amount !== 'number' || p.amount <= 0 || !Number.isInteger(p.amount)) {
        throw new BadRequestError('All payer amounts must be positive integers');
      }
    }
    const payerTotal = payers.reduce((sum, p) => sum + p.amount, 0);
    if (payerTotal !== totalAmount) {
      throw new BadRequestError('Payer amounts must sum to total amount');
    }

    // 4. Calculate split amounts based on splitType
    const calculatedSplits = calculateSplits(splitType, splits, totalAmount);

    // 5. Verify calculated split amounts sum to totalAmount
    const splitSum = calculatedSplits.reduce((sum, s) => sum + s.amount, 0);
    if (splitSum !== totalAmount) {
      throw new BadRequestError('Split amounts must sum to total amount');
    }

    // 6. Insert into expenses
    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, title, description, total_amount, split_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, group_id, title, description, total_amount, split_type, created_by, created_at, updated_at`,
      [
        groupId,
        title.trim(),
        description && description.trim() ? description.trim() : null,
        totalAmount,
        splitType,
        createdBy,
      ]
    );
    const expense = expenseResult.rows[0];

    // Insert payers
    for (const payer of payers) {
      await client.query(
        `INSERT INTO expense_payers (expense_id, user_id, amount)
         VALUES ($1, $2, $3)`,
        [expense.id, payer.userId, payer.amount]
      );
    }

    // Insert splits
    for (const split of calculatedSplits) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4)`,
        [expense.id, split.userId, split.amount, split.percentage]
      );
    }

    // Fetch user details for payers and splits before committing
    const payersQuery = await client.query(
      `SELECT ep.id, ep.user_id, ep.amount, u.name, u.email
       FROM expense_payers ep
       JOIN users u ON u.id = ep.user_id
       WHERE ep.expense_id = $1
       ORDER BY u.name ASC`,
      [expense.id]
    );

    const splitsQuery = await client.query(
      `SELECT es.id, es.user_id, es.amount, es.percentage, u.name, u.email
       FROM expense_splits es
       JOIN users u ON u.id = es.user_id
       WHERE es.expense_id = $1
       ORDER BY u.name ASC`,
      [expense.id]
    );

    await client.query('COMMIT');

    return {
      id: expense.id,
      groupId: expense.group_id,
      title: expense.title,
      description: expense.description,
      totalAmount: expense.total_amount,
      splitType: expense.split_type,
      createdBy: expense.created_by,
      createdAt: expense.created_at,
      updatedAt: expense.updated_at,
      payers: payersQuery.rows.map((p) => ({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        email: p.email,
        amount: p.amount,
      })),
      splits: splitsQuery.rows.map((s) => ({
        id: s.id,
        userId: s.user_id,
        name: s.name,
        email: s.email,
        amount: s.amount,
        percentage: s.percentage !== null ? parseFloat(s.percentage) : null,
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get all expenses for a group
 */
export const getGroupExpenses = async (groupId) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  const expensesResult = await db.query(
    `SELECT e.id, e.group_id, e.title, e.description, e.total_amount, e.split_type,
            e.created_by, e.created_at, e.updated_at,
            u.name as creator_name, u.email as creator_email
     FROM expenses e
     JOIN users u ON u.id = e.created_by
     WHERE e.group_id = $1
     ORDER BY e.created_at DESC`,
    [groupId]
  );

  const expenses = expensesResult.rows;
  if (expenses.length === 0) {
    return [];
  }

  const expenseIds = expenses.map((e) => e.id);

  // Fetch payers for all expenses
  const payersResult = await db.query(
    `SELECT ep.id, ep.expense_id, ep.user_id, ep.amount, u.name, u.email
     FROM expense_payers ep
     JOIN users u ON u.id = ep.user_id
     WHERE ep.expense_id = ANY($1::uuid[])
     ORDER BY u.name ASC`,
    [expenseIds]
  );

  // Fetch splits for all expenses
  const splitsResult = await db.query(
    `SELECT es.id, es.expense_id, es.user_id, es.amount, es.percentage, u.name, u.email
     FROM expense_splits es
     JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = ANY($1::uuid[])
     ORDER BY u.name ASC`,
    [expenseIds]
  );

  const payersByExpense = {};
  for (const p of payersResult.rows) {
    if (!payersByExpense[p.expense_id]) payersByExpense[p.expense_id] = [];
    payersByExpense[p.expense_id].push({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      email: p.email,
      amount: p.amount,
    });
  }

  const splitsByExpense = {};
  for (const s of splitsResult.rows) {
    if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
    splitsByExpense[s.expense_id].push({
      id: s.id,
      userId: s.user_id,
      name: s.name,
      email: s.email,
      amount: s.amount,
      percentage: s.percentage !== null ? parseFloat(s.percentage) : null,
    });
  }

  return expenses.map((e) => ({
    id: e.id,
    groupId: e.group_id,
    title: e.title,
    description: e.description,
    totalAmount: e.total_amount,
    splitType: e.split_type,
    createdBy: e.created_by,
    creator: {
      id: e.created_by,
      name: e.creator_name,
      email: e.creator_email,
    },
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    payers: payersByExpense[e.id] || [],
    splits: splitsByExpense[e.id] || [],
  }));
};

/**
 * Get an expense by ID, verifying requesting user is a group member
 */
export const getExpenseById = async (expenseId, requestingUserId) => {
  if (!expenseId || !isValidUUID(expenseId)) {
    throw new BadRequestError('Invalid expense ID');
  }

  const expenseResult = await db.query(
    `SELECT e.id, e.group_id, e.title, e.description, e.total_amount, e.split_type,
            e.created_by, e.created_at, e.updated_at,
            u.name as creator_name, u.email as creator_email
     FROM expenses e
     JOIN users u ON u.id = e.created_by
     WHERE e.id = $1`,
    [expenseId]
  );

  if (expenseResult.rows.length === 0) {
    throw new NotFoundError('Expense not found');
  }

  const expense = expenseResult.rows[0];

  // Verify requesting user is an active member of the expense's group
  if (requestingUserId) {
    const memberResult = await db.query(
      `SELECT id, role, status FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [expense.group_id, requestingUserId]
    );

    if (memberResult.rows.length === 0 || memberResult.rows[0].status !== 'active') {
      throw new ForbiddenError('You are not an active member of this group');
    }
  }

  // Fetch payers
  const payersResult = await db.query(
    `SELECT ep.id, ep.user_id, ep.amount, u.name, u.email
     FROM expense_payers ep
     JOIN users u ON u.id = ep.user_id
     WHERE ep.expense_id = $1
     ORDER BY u.name ASC`,
    [expenseId]
  );

  // Fetch splits
  const splitsResult = await db.query(
    `SELECT es.id, es.user_id, es.amount, es.percentage, u.name, u.email
     FROM expense_splits es
     JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = $1
     ORDER BY u.name ASC`,
    [expenseId]
  );

  return {
    id: expense.id,
    groupId: expense.group_id,
    title: expense.title,
    description: expense.description,
    totalAmount: expense.total_amount,
    splitType: expense.split_type,
    createdBy: expense.created_by,
    creator: {
      id: expense.created_by,
      name: expense.creator_name,
      email: expense.creator_email,
    },
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
    payers: payersResult.rows.map((p) => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      email: p.email,
      amount: p.amount,
    })),
    splits: splitsResult.rows.map((s) => ({
      id: s.id,
      userId: s.user_id,
      name: s.name,
      email: s.email,
      amount: s.amount,
      percentage: s.percentage !== null ? parseFloat(s.percentage) : null,
    })),
  };
};

/**
 * Update an expense inside a database transaction
 */
export const updateExpense = async (expenseId, updates, userId) => {
  if (!expenseId || !isValidUUID(expenseId)) {
    throw new BadRequestError('Invalid expense ID');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Find expense and group creator
    const expenseResult = await client.query(
      `SELECT e.*, g.created_by as group_creator_id
       FROM expenses e
       JOIN groups g ON g.id = e.group_id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (expenseResult.rows.length === 0) {
      throw new NotFoundError('Expense not found');
    }

    const expense = expenseResult.rows[0];

    // Verify authorization: userId must be expense creator OR group creator
    if (expense.created_by !== userId && expense.group_creator_id !== userId) {
      throw new ForbiddenError('Only the expense creator or group creator can update this expense');
    }

    const title = updates.title !== undefined ? updates.title.trim() : expense.title;
    const description =
      updates.description !== undefined
        ? updates.description && updates.description.trim()
          ? updates.description.trim()
          : null
        : expense.description;

    const hasFinancialUpdates =
      updates.totalAmount !== undefined ||
      updates.splitType !== undefined ||
      updates.payers !== undefined ||
      updates.splits !== undefined;

    if (hasFinancialUpdates) {
      const totalAmount = updates.totalAmount !== undefined ? updates.totalAmount : expense.total_amount;
      const splitType = updates.splitType !== undefined ? updates.splitType : expense.split_type;

      if (typeof totalAmount !== 'number' || totalAmount <= 0 || !Number.isInteger(totalAmount)) {
        throw new BadRequestError('Total amount must be a positive integer in paise');
      }

      if (!['equal', 'exact', 'percentage'].includes(splitType)) {
        throw new BadRequestError("Split type must be 'equal', 'exact', or 'percentage'");
      }

      // Determine payers to use
      let payers = updates.payers;
      if (!payers) {
        const existingPayers = await client.query(
          `SELECT user_id as "userId", amount FROM expense_payers WHERE expense_id = $1`,
          [expenseId]
        );
        payers = existingPayers.rows;
      }

      // Determine splits to use
      let splits = updates.splits;
      if (!splits) {
        const existingSplits = await client.query(
          `SELECT user_id as "userId", amount, percentage FROM expense_splits WHERE expense_id = $1`,
          [expenseId]
        );
        splits = existingSplits.rows.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage !== null ? parseFloat(s.percentage) : null,
        }));
      }

      // Validate payers are active group members
      const payerUserIds = payers.map((p) => p.userId);
      await validateGroupMembers(client, expense.group_id, payerUserIds, 'payers');

      // Validate split participants are active group members
      const splitUserIds = splits.map((s) => s.userId);
      await validateGroupMembers(client, expense.group_id, splitUserIds, 'split participants');

      // Validate payer amounts sum to totalAmount
      for (const p of payers) {
        if (typeof p.amount !== 'number' || p.amount <= 0 || !Number.isInteger(p.amount)) {
          throw new BadRequestError('All payer amounts must be positive integers');
        }
      }
      const payerTotal = payers.reduce((sum, p) => sum + p.amount, 0);
      if (payerTotal !== totalAmount) {
        throw new BadRequestError('Payer amounts must sum to total amount');
      }

      // Calculate splits
      const calculatedSplits = calculateSplits(splitType, splits, totalAmount);

      // Verify calculated split amounts sum to totalAmount
      const splitSum = calculatedSplits.reduce((sum, s) => sum + s.amount, 0);
      if (splitSum !== totalAmount) {
        throw new BadRequestError('Split amounts must sum to total amount');
      }

      // Delete existing payers and splits
      await client.query('DELETE FROM expense_payers WHERE expense_id = $1', [expenseId]);
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expenseId]);

      // Re-insert payers
      for (const payer of payers) {
        await client.query(
          `INSERT INTO expense_payers (expense_id, user_id, amount)
           VALUES ($1, $2, $3)`,
          [expenseId, payer.userId, payer.amount]
        );
      }

      // Re-insert splits
      for (const split of calculatedSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
           VALUES ($1, $2, $3, $4)`,
          [expenseId, split.userId, split.amount, split.percentage]
        );
      }

      // Update expense table
      await client.query(
        `UPDATE expenses
         SET title = $1, description = $2, total_amount = $3, split_type = $4, updated_at = NOW()
         WHERE id = $5`,
        [title, description, totalAmount, splitType, expenseId]
      );
    } else {
      // Only metadata update
      await client.query(
        `UPDATE expenses
         SET title = $1, description = $2, updated_at = NOW()
         WHERE id = $3`,
        [title, description, expenseId]
      );
    }

    await client.query('COMMIT');

    return await getExpenseById(expenseId, userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete an expense
 */
export const deleteExpense = async (expenseId, userId) => {
  if (!expenseId || !isValidUUID(expenseId)) {
    throw new BadRequestError('Invalid expense ID');
  }

  const expenseResult = await db.query(
    `SELECT e.*, g.created_by as group_creator_id
     FROM expenses e
     JOIN groups g ON g.id = e.group_id
     WHERE e.id = $1`,
    [expenseId]
  );

  if (expenseResult.rows.length === 0) {
    throw new NotFoundError('Expense not found');
  }

  const expense = expenseResult.rows[0];

  if (expense.created_by !== userId && expense.group_creator_id !== userId) {
    throw new ForbiddenError('Only the expense creator or group creator can delete this expense');
  }

  await db.query('DELETE FROM expenses WHERE id = $1', [expenseId]);

  return { deleted: true, id: expenseId };
};
