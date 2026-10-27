import { Router } from 'express';
import Joi from 'joi';
import * as groupController from '../controllers/groupController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGroupMember, requireGroupCreator } from '../middleware/groupAccess.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Validation schemas
const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Group name is required',
    'string.min': 'Group name must be at least 2 characters long',
    'string.max': 'Group name cannot exceed 150 characters',
    'any.required': 'Group name is required',
  }),
  description: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

const addMemberSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required',
  }),
});

// All group routes require authentication
router.use(authenticate);

// Group CRUD
router.post('/groups', validate(createGroupSchema), groupController.createGroup);
router.get('/groups', groupController.getUserGroups);
router.get('/groups/:groupId', requireGroupMember, groupController.getGroupById);

// Group Members
router.post(
  '/groups/:groupId/members',
  requireGroupCreator,
  validate(addMemberSchema),
  groupController.addMember
);
router.get('/groups/:groupId/members', requireGroupMember, groupController.getGroupMembers);
router.delete(
  '/groups/:groupId/members/:memberId',
  requireGroupCreator,
  groupController.removeMember
);

export default router;
