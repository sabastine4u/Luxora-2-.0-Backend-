/**
 * Global Error Handling Middleware
 * Catches all errors passed to next(error) anywhere in the application.
 */

const globalErrorHandler = (err, req, res, next) => {
    // Read the HTTP status code from the AppError object.
  // If the error isn't an AppError (for example, an unexpected
  // JavaScript or server error), default to 500.
    const statusCode = err.statusCode || 500;

    // Read the error message.
  // If no message exists, send a generic message instead.
    const message = err.message || "Something went wrong on the server";    

    // Send a consistent error response back to the frontend.
    res.status(statusCode).json({
        success: false,
        message,
    });
};

module.exports = globalErrorHandler;