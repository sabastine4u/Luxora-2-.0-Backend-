/**
 * AppError Class
 * Extends the built-in Node.js Error class to include HTTP status codes
 * and an operational flag for clean, centralized error handling.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    // 1. Call the parent (Error) constructor with the message
    // This ensures the built-in Error features still work properly
    super(message);

    // 2. Set the HTTP status code (defaults to 500 Internal Server Error if none is provided)
    this.statusCode = statusCode;

    // 3. Flag this error as operational
    // This tells our app that this is a predictable, expected error (like "Invalid password")
    // so it is safe to send the exact message to the user instead of a generic crash message.
    this.isOperational = true;

    // 4. Capture the stack trace (points directly to the file and line that caused the error)
    // We pass `this.constructor` so this specific file doesn't clutter the trace logs.
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;