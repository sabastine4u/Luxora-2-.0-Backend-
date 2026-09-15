const analyticsService = require("../services/analytics.service");

// Return analytics for the authenticated Owner.
const getOwnerAnalytics = async (req, res, next) => {
  try {
    // Build analytics only from properties owned by the authenticated user.
    const analytics = await analyticsService.getOwnerAnalytics(req.user._id);

    // Return the Owner analytics payload.
    return res.status(200).json({
      status: "success",
      data: {
        analytics,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
  };

// Export the analytics controller.
module.exports = {
  getOwnerAnalytics,
};