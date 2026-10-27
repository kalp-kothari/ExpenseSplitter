import { Router } from 'express';
import * as balanceController from '../controllers/balanceController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/groupAccess.js';

const router = Router();

router.get(
  '/groups/:groupId/balances',
  authenticate,
  requireGroupMember,
  balanceController.getGroupBalances
);

router.get(
  '/groups/:groupId/settlements/suggestions',
  authenticate,
  requireGroupMember,
  balanceController.getSettlementSuggestions
);

export default router;
