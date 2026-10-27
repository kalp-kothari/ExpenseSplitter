export const formatResponse = (data, message = null) => ({
  success: true,
  ...(message && { message }),
  data,
});

export const formatError = (message, errors = []) => ({
  success: false,
  message,
  ...(errors.length > 0 && { errors }),
});

export const isValidUUID = (str) => {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};
