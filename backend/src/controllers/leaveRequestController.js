import * as leaveRequestService from '../services/leaveRequestService.js';
import { formatResponse } from '../utils/helpers.js';

/**
 * Create a leave request
 * POST /groups/:groupId/leave-requests
 */
export const createLeaveRequest = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const leaveRequest = await leaveRequestService.createLeaveRequest(
      req.params.groupId,
      req.user.id,
      reason
    );
    res.status(201).json(formatResponse(leaveRequest, 'Leave request submitted successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all leave requests for a group
 * GET /groups/:groupId/leave-requests
 */
export const getGroupLeaveRequests = async (req, res, next) => {
  try {
    const leaveRequests = await leaveRequestService.getGroupLeaveRequests(req.params.groupId);
    res.status(200).json(formatResponse(leaveRequests));
  } catch (error) {
    next(error);
  }
};

/**
 * Update (approve/reject) a leave request
 * PATCH /leave-requests/:requestId
 */
export const updateLeaveRequest = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const updated = await leaveRequestService.updateLeaveRequest(
      req.params.requestId,
      status,
      adminNote,
      req.user.id
    );
    res.status(200).json(formatResponse(updated, `Leave request ${status} successfully`));
  } catch (error) {
    next(error);
  }
};
