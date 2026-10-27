import * as balanceService from '../services/balanceService.js';
import { formatResponse } from '../utils/helpers.js';

/**
 * Get balances for all members in a group
 * GET /groups/:groupId/balances
 */
export const getGroupBalances = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await balanceService.getGroupBalances(groupId);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};

/**
 * Get suggested settlements to minimize transactions
 * GET /groups/:groupId/settlements/suggestions
 */
export const getSettlementSuggestions = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await balanceService.getSettlementSuggestions(groupId);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};
