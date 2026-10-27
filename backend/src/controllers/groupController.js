import * as groupService from '../services/groupService.js';
import { formatResponse } from '../utils/helpers.js';

/**
 * Create a new group
 * POST /groups
 */
export const createGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const group = await groupService.createGroup(name, description, req.user.id);
    res.status(201).json(formatResponse(group, 'Group created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all groups for authenticated user
 * GET /groups
 */
export const getUserGroups = async (req, res, next) => {
  try {
    const groups = await groupService.getUserGroups(req.user.id);
    res.status(200).json(formatResponse(groups));
  } catch (error) {
    next(error);
  }
};

/**
 * Get group details by ID
 * GET /groups/:groupId
 */
export const getGroupById = async (req, res, next) => {
  try {
    const group = await groupService.getGroupById(req.params.groupId);
    res.status(200).json(formatResponse(group));
  } catch (error) {
    next(error);
  }
};

/**
 * Add a member to a group
 * POST /groups/:groupId/members
 */
export const addMember = async (req, res, next) => {
  try {
    const { email } = req.body;
    const member = await groupService.addMember(req.params.groupId, email, req.user.id);
    res.status(201).json(formatResponse(member, 'Member added successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all members of a group
 * GET /groups/:groupId/members
 */
export const getGroupMembers = async (req, res, next) => {
  try {
    const members = await groupService.getGroupMembers(req.params.groupId);
    res.status(200).json(formatResponse(members));
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a member from a group
 * DELETE /groups/:groupId/members/:memberId
 */
export const removeMember = async (req, res, next) => {
  try {
    const result = await groupService.removeMember(req.params.groupId, req.params.memberId, req.user.id);
    res.status(200).json(formatResponse(result, 'Member removed successfully'));
  } catch (error) {
    next(error);
  }
};
