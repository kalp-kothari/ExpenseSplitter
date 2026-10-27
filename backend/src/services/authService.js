import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import config from '../config/index.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

const SALT_ROUNDS = 10;

/**
 * Register a new user
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{ user: { id: string, name: string, email: string, createdAt: Date }, token: string }>}
 */
export const register = async (name, email, password) => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  // Validate email uniqueness
  const existingUser = await db.query(
    'SELECT id FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  if (existingUser.rows.length > 0) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Insert user
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [trimmedName, normalizedEmail, passwordHash]
  );

  const newUser = result.rows[0];

  // Generate JWT token
  const token = jwt.sign(
    {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.created_at,
    },
    token,
  };
};

/**
 * Login user with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{ user: { id: string, name: string, email: string, createdAt: Date }, token: string }>}
 */
export const login = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const result = await db.query(
    'SELECT id, name, email, password_hash, created_at FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    },
    token,
  };
};

/**
 * Get user profile by ID
 * @param {string} userId 
 * @returns {Promise<{ id: string, name: string, email: string, createdAt: Date, updatedAt: Date }>}
 */
export const getProfile = async (userId) => {
  const result = await db.query(
    'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};
