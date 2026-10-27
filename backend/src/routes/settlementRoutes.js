import { Router } from 'express';
import Joi from 'joi';
import * as settlementController from '../controllers/settlementController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/groupAccess.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSettlementSchema = Joi.object({
  payerId: Joi.string().uuid().required().messages({
    'string.guid': 'Payer ID must be a valid UUID',
    'any.required': 'Payer ID is required',
  }),
  receiverId: Joi.string().uuid().required().messages({
    'string.guid': 'Receiver ID must be a valid UUID',
    'any.required': 'Receiver ID is required',
  }),
  amount: Joi.number().integer().positive().required().messages({
    'number.base': 'Amount must be a number',
    'number.integer': 'Amount must be an integer in paise',
    'number.positive': 'Amount must be greater than 0',
    'any.required': 'Amount is required',
  }),
});

const updateSettlementSchema = Joi.object({
  status: Joi.string().valid('completed', 'cancelled').required().messages({
    'any.only': "Status must be either 'completed' or 'cancelled'",
    'any.required': 'Status is required',
  }),
});

router.post(
  '/groups/:groupId/settlements',
  authenticate,
  requireGroupMember,
  validate(createSettlementSchema),
  settlementController.createSettlement
);

router.get(
  '/groups/:groupId/settlements',
  authenticate,
  requireGroupMember,
  settlementController.getGroupSettlements
);

router.patch(
  '/settlements/:settlementId',
  authenticate,
  validate(updateSettlementSchema),
  settlementController.updateSettlement
);

export default router;
