import * as authService from '../services/authService.js';
import { formatResponse } from '../utils/helpers.js';

const setAuthCookie = (res, token) => {
  if (!token) return;
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

/**
 * Register controller
 * POST /auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    setAuthCookie(res, result.token);
    res.status(201).json(formatResponse(result, 'User registered successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Login controller
 * POST /auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    setAuthCookie(res, result.token);
    res.status(200).json(formatResponse(result, 'Login successful'));
  } catch (error) {
    next(error);
  }
};

/**
 * Logout controller
 * POST /auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    res.status(200).json(formatResponse(null, 'Logout successful'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile controller
 * GET /auth/me
 */
export const getProfile = async (req, res, next) => {
  try {
    const result = await authService.getProfile(req.user.id);
    res.status(200).json(formatResponse(result));
  } catch (error) {
    next(error);
  }
};
