import { Router } from 'express';
import Joi from 'joi';
import * as leaveRequestController from '../controllers/leaveRequestController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/groupAccess.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createLeaveRequestSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Reason cannot exceed 500 characters',
  }),
});

const updateLeaveRequestSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required().messages({
    'any.only': 'Status must be either approved or rejected',
    'any.required': 'Status is required',
  }),
  adminNote: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Admin note cannot exceed 500 characters',
  }),
});

// Group-scoped leave request endpoints
router.post(
  '/groups/:groupId/leave-requests',
  authenticate,
  requireGroupMember,
  validate(createLeaveRequestSchema),
  leaveRequestController.createLeaveRequest
);

router.get(
  '/groups/:groupId/leave-requests',
  authenticate,
  requireGroupMember,
  leaveRequestController.getGroupLeaveRequests
);

// Leave request decision endpoint
// Note: Group creator authorization check is handled inside leaveRequestService.updateLeaveRequest
router.patch(
  '/leave-requests/:requestId',
  authenticate,
  validate(updateLeaveRequestSchema),
  leaveRequestController.updateLeaveRequest
);

export default router;
