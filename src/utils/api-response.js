/**
 * API Response Helpers
 * Provides consistent success responses across the application.
 */

// Sends a standard successful response (200 OK by default).
// The same helper can also send other success status codes when needed.
const success = (res, data = {}, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });

// Sends a 201 Created response for newly created resources.
// Reuses the success() helper instead of duplicating the response logic.
const created = (
  res,
  data = {},
  message = "Created Successfully"
) => success(res, data, message, 201);

module.exports = {
  success,
  created,
};