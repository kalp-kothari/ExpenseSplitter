import db from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { isValidUUID } from '../utils/helpers.js';

/**
 * Get comprehensive balances for all active members in a group
 */
export const getGroupBalances = async (groupId) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  // Check group existence
  const groupCheck = await db.query('SELECT id FROM groups WHERE id = $1', [groupId]);
  if (groupCheck.rows.length === 0) {
    throw new NotFoundError('Group not found');
  }

  // Get total expenses for the group
  const totalExpensesResult = await db.query(
    'SELECT COALESCE(SUM(total_amount), 0)::int as total_expenses FROM expenses WHERE group_id = $1',
    [groupId]
  );
  const totalExpenses = parseInt(totalExpensesResult.rows[0]?.total_expenses || 0, 10);

  // Single efficient query to calculate all member balances
  const balancesResult = await db.query(
    `WITH member_paid AS (
      SELECT ep.user_id, COALESCE(SUM(ep.amount), 0) as total_paid
      FROM expense_payers ep
      JOIN expenses e ON e.id = ep.expense_id
      WHERE e.group_id = $1
      GROUP BY ep.user_id
    ),
    member_owed AS (
      SELECT es.user_id, COALESCE(SUM(es.amount), 0) as total_owed
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = $1
      GROUP BY es.user_id
    ),
    settled_paid AS (
      SELECT payer_id as user_id, COALESCE(SUM(amount), 0) as total
      FROM settlements
      WHERE group_id = $1 AND status = 'completed'
      GROUP BY payer_id
    ),
    settled_received AS (
      SELECT receiver_id as user_id, COALESCE(SUM(amount), 0) as total
      FROM settlements
      WHERE group_id = $1 AND status = 'completed'
      GROUP BY receiver_id
    )
    SELECT
      gm.user_id, u.name, u.email,
      COALESCE(mp.total_paid, 0)::int as total_paid,
      COALESCE(mo.total_owed, 0)::int as total_owed,
      COALESCE(sp.total, 0)::int as settled_paid,
      COALESCE(sr.total, 0)::int as settled_received,
      (COALESCE(mp.total_paid, 0) - COALESCE(mo.total_owed, 0) + COALESCE(sp.total, 0) - COALESCE(sr.total, 0))::int as net_balance
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN member_paid mp ON mp.user_id = gm.user_id
    LEFT JOIN member_owed mo ON mo.user_id = gm.user_id
    LEFT JOIN settled_paid sp ON sp.user_id = gm.user_id
    LEFT JOIN settled_received sr ON sr.user_id = gm.user_id
    WHERE gm.group_id = $1 AND gm.status = 'active'
    ORDER BY u.name ASC`,
    [groupId]
  );

  const balances = balancesResult.rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    totalPaid: parseInt(r.total_paid, 10),
    totalOwed: parseInt(r.total_owed, 10),
    settledPaid: parseInt(r.settled_paid, 10),
    settledReceived: parseInt(r.settled_received, 10),
    netBalance: parseInt(r.net_balance, 10),
  }));

  const membersOwed = balances.filter((b) => b.netBalance > 0);
  const membersOwing = balances.filter((b) => b.netBalance < 0);

  return {
    balances,
    summary: {
      totalExpenses,
      membersOwed,
      membersOwing,
    },
  };
};

/**
 * Calculate direct pairwise settlement suggestions between members
 */
export const getSettlementSuggestions = async (groupId) => {
  if (!groupId || !isValidUUID(groupId)) {
    throw new BadRequestError('Invalid group ID');
  }

  // Fetch all active members in the group
  const membersRes = await db.query(
    `SELECT u.id, u.name, u.email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND gm.status = 'active'`,
    [groupId]
  );
  const users = {};
  for (const m of membersRes.rows) {
    users[m.id] = { userId: m.id, name: m.name, email: m.email };
  }

  // Fetch expenses with payers and splits
  const splitsRes = await db.query(
    `SELECT ep.user_id as payer_id, ep.amount as payer_amount,
            es.user_id as borrower_id, es.amount as split_amount,
            e.total_amount
     FROM expense_splits es
     JOIN expense_payers ep ON ep.expense_id = es.expense_id
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1`,
    [groupId]
  );

  const pairDebts = {};
  const getPairKey = (u1, u2) => (u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`);

  for (const row of splitsRes.rows) {
    if (row.payer_id === row.borrower_id) continue;
    const owed =
      row.total_amount > 0
        ? Math.round((row.split_amount * row.payer_amount) / row.total_amount)
        : row.split_amount;
    const k = getPairKey(row.borrower_id, row.payer_id);
    if (!pairDebts[k]) {
      pairDebts[k] = {
        u1: row.borrower_id < row.payer_id ? row.borrower_id : row.payer_id,
        u2: row.borrower_id < row.payer_id ? row.payer_id : row.borrower_id,
        net: 0,
      };
    }
    if (row.borrower_id < row.payer_id) {
      pairDebts[k].net += owed; // borrower owes payer
    } else {
      pairDebts[k].net -= owed;
    }
  }

  // Adjust for completed settlements
  const settsRes = await db.query(
    `SELECT payer_id, receiver_id, amount
     FROM settlements
     WHERE group_id = $1 AND status = 'completed'`,
    [groupId]
  );
  for (const s of settsRes.rows) {
    const k = getPairKey(s.payer_id, s.receiver_id);
    if (!pairDebts[k]) {
      pairDebts[k] = {
        u1: s.payer_id < s.receiver_id ? s.payer_id : s.receiver_id,
        u2: s.payer_id < s.receiver_id ? s.receiver_id : s.payer_id,
        net: 0,
      };
    }
    if (s.payer_id < s.receiver_id) {
      pairDebts[k].net -= s.amount;
    } else {
      pairDebts[k].net += s.amount;
    }
  }

  const suggestions = [];
  for (const k of Object.keys(pairDebts)) {
    const { u1, u2, net } = pairDebts[k];
    if (net > 0 && users[u1] && users[u2]) {
      suggestions.push({
        from: users[u1],
        to: users[u2],
        amount: net,
      });
    } else if (net < 0 && users[u1] && users[u2]) {
      suggestions.push({
        from: users[u2],
        to: users[u1],
        amount: Math.abs(net),
      });
    }
  }

  // Sort descending by amount
  suggestions.sort((a, b) => b.amount - a.amount);

  return {
    suggestions,
    totalTransactions: suggestions.length,
  };
};
