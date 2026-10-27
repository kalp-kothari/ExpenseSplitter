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
 * Calculate greedy settlement suggestions to minimize transactions
 */
export const getSettlementSuggestions = async (groupId) => {
  const balanceData = await getGroupBalances(groupId);

  const debtors = balanceData.balances
    .filter((b) => b.netBalance < 0)
    .map((b) => ({ ...b, netBalance: b.netBalance }))
    .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

  const creditors = balanceData.balances
    .filter((b) => b.netBalance > 0)
    .map((b) => ({ ...b, netBalance: b.netBalance }))
    .sort((a, b) => b.netBalance - a.netBalance);

  const suggestions = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];
    const amount = Math.min(Math.abs(debtor.netBalance), creditor.netBalance);

    if (amount > 0) {
      suggestions.push({
        from: { userId: debtor.userId, name: debtor.name, email: debtor.email },
        to: { userId: creditor.userId, name: creditor.name, email: creditor.email },
        amount,
      });
    }

    debtor.netBalance += amount;
    creditor.netBalance -= amount;

    if (debtor.netBalance === 0) debtorIdx++;
    if (creditor.netBalance === 0) creditorIdx++;
  }

  return {
    suggestions,
    totalTransactions: suggestions.length,
  };
};
