import config from '../config/index.js';
import { formatError } from '../utils/helpers.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  const errors = err.errors || [];

  if (config.nodeEnv === 'development') {
    console.error('Error encountered:', {
      name: err.name,
      message: err.message,
      statusCode,
      stack: err.stack,
      errors: err.errors,
    });
  }

  // In production, mask internal server error details
  if (config.nodeEnv === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json(formatError(message, errors));
};

export const notFoundHandler = (req, res, next) => {
  res.status(404).json(formatError(`Route ${req.method} ${req.originalUrl} not found`));
};
