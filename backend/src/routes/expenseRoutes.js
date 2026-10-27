import { Router } from 'express';
import Joi from 'joi';
import * as expenseController from '../controllers/expenseController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/groupAccess.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createExpenseSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().trim().max(1000).allow('', null).optional().messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),
  totalAmount: Joi.number().integer().positive().required().messages({
    'number.base': 'Total amount must be a number',
    'number.integer': 'Total amount must be an integer in paise',
    'number.positive': 'Total amount must be greater than 0',
    'any.required': 'Total amount is required',
  }),
  splitType: Joi.string().valid('equal', 'exact', 'percentage').required().messages({
    'any.only': "Split type must be 'equal', 'exact', or 'percentage'",
    'any.required': 'Split type is required',
  }),
  payers: Joi.array()
    .min(1)
    .required()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required().messages({
          'string.guid': 'Payer userId must be a valid UUID',
          'any.required': 'Payer userId is required',
        }),
        amount: Joi.number().integer().positive().required().messages({
          'number.base': 'Payer amount must be a number',
          'number.integer': 'Payer amount must be an integer in paise',
          'number.positive': 'Payer amount must be greater than 0',
          'any.required': 'Payer amount is required',
        }),
      })
    )
    .messages({
      'array.min': 'At least one payer is required',
      'any.required': 'Payers are required',
    }),
  splits: Joi.array()
    .min(1)
    .required()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required().messages({
          'string.guid': 'Split userId must be a valid UUID',
          'any.required': 'Split userId is required',
        }),
        amount: Joi.number().integer().positive().optional().messages({
          'number.base': 'Split amount must be a number',
          'number.integer': 'Split amount must be an integer in paise',
          'number.positive': 'Split amount must be greater than 0',
        }),
        percentage: Joi.number().positive().max(100).optional().messages({
          'number.base': 'Split percentage must be a number',
          'number.positive': 'Split percentage must be greater than 0',
          'number.max': 'Split percentage cannot exceed 100',
        }),
      })
    )
    .messages({
      'array.min': 'At least one split participant is required',
      'any.required': 'Splits are required',
    }),
});

const updateExpenseSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional().messages({
    'string.empty': 'Title cannot be empty',
    'string.max': 'Title cannot exceed 200 characters',
  }),
  description: Joi.string().trim().max(1000).allow('', null).optional().messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),
  totalAmount: Joi.number().integer().positive().optional().messages({
    'number.base': 'Total amount must be a number',
    'number.integer': 'Total amount must be an integer in paise',
    'number.positive': 'Total amount must be greater than 0',
  }),
  splitType: Joi.string().valid('equal', 'exact', 'percentage').optional().messages({
    'any.only': "Split type must be 'equal', 'exact', or 'percentage'",
  }),
  payers: Joi.array()
    .min(1)
    .optional()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required().messages({
          'string.guid': 'Payer userId must be a valid UUID',
          'any.required': 'Payer userId is required',
        }),
        amount: Joi.number().integer().positive().required().messages({
          'number.base': 'Payer amount must be a number',
          'number.integer': 'Payer amount must be an integer in paise',
          'number.positive': 'Payer amount must be greater than 0',
          'any.required': 'Payer amount is required',
        }),
      })
    )
    .messages({
      'array.min': 'At least one payer is required if payers are provided',
    }),
  splits: Joi.array()
    .min(1)
    .optional()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required().messages({
          'string.guid': 'Split userId must be a valid UUID',
          'any.required': 'Split userId is required',
        }),
        amount: Joi.number().integer().positive().optional().messages({
          'number.base': 'Split amount must be a number',
          'number.integer': 'Split amount must be an integer in paise',
          'number.positive': 'Split amount must be greater than 0',
        }),
        percentage: Joi.number().positive().max(100).optional().messages({
          'number.base': 'Split percentage must be a number',
          'number.positive': 'Split percentage must be greater than 0',
          'number.max': 'Split percentage cannot exceed 100',
        }),
      })
    )
    .messages({
      'array.min': 'At least one split participant is required if splits are provided',
    }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// Group-scoped expense routes
router.post(
  '/groups/:groupId/expenses',
  authenticate,
  requireGroupMember,
  validate(createExpenseSchema),
  expenseController.createExpense
);

router.get(
  '/groups/:groupId/expenses',
  authenticate,
  requireGroupMember,
  expenseController.getGroupExpenses
);

// Individual expense routes
router.get(
  '/expenses/:expenseId',
  authenticate,
  expenseController.getExpenseById
);

router.patch(
  '/expenses/:expenseId',
  authenticate,
  validate(updateExpenseSchema),
  expenseController.updateExpense
);

router.delete(
  '/expenses/:expenseId',
  authenticate,
  expenseController.deleteExpense
);

export default router;
