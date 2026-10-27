import * as settlementService from '../services/settlementService.js';
import { formatResponse } from '../utils/helpers.js';

/**
 * Create a new settlement
 * POST /groups/:groupId/settlements
 */
export const createSettlement = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await settlementService.createSettlement(groupId, req.body, req.user.id);
    res.status(201).json(formatResponse(result, 'Settlement created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all settlements for a group
 * GET /groups/:groupId/settlements
 */
export const getGroupSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await settlementService.getGroupSettlements(groupId);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};

/**
 * Update settlement status (completed or cancelled)
 * PATCH /settlements/:settlementId
 */
export const updateSettlement = async (req, res, next) => {
  try {
    const { settlementId } = req.params;
    const { status } = req.body;
    const result = await settlementService.updateSettlement(settlementId, status, req.user.id);
    res.status(200).json(formatResponse(result, 'Settlement updated successfully'));
  } catch (error) {
    next(error);
  }
};
