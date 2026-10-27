import * as expenseService from '../services/expenseService.js';
import { formatResponse } from '../utils/helpers.js';

/**
 * Create a new expense in a group
 * POST /groups/:groupId/expenses
 */
export const createExpense = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await expenseService.createExpense(groupId, req.body, req.user.id);
    res.status(201).json(formatResponse(result, 'Expense created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all expenses for a group
 * GET /groups/:groupId/expenses
 */
export const getGroupExpenses = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await expenseService.getGroupExpenses(groupId);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};

/**
 * Get an expense by ID
 * GET /expenses/:expenseId
 */
export const getExpenseById = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const result = await expenseService.getExpenseById(expenseId, req.user.id);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing expense
 * PATCH /expenses/:expenseId
 */
export const updateExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const result = await expenseService.updateExpense(expenseId, req.body, req.user.id);
    res.status(200).json(formatResponse(result, 'Expense updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an expense
 * DELETE /expenses/:expenseId
 */
export const deleteExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const result = await expenseService.deleteExpense(expenseId, req.user.id);
    res.status(200).json(formatResponse(result, 'Expense deleted successfully'));
  } catch (error) {
    next(error);
  }
};
