// Import the Agency Performance service.
const performanceService = require("../services/performance.service");

// Return Performance analytics for the authenticated Agency.
const getAgencyPerformance = async (req, res, next) => {
  try {
    // Build the dashboard from real Agency-related records.
    const performance =
      await performanceService.getAgencyPerformance(
        req.user._id,
      );

    // Return the Performance payload.
    return res.status(200).json({
      success: true,
      data: {
        performance,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to global error handling.
    return next(error);
  }
};

const getAgentPerformance = async (req, res, next) => {
  try {
    const performance =
      await performanceService.getAgentPerformance(
        req.user._id,
      );

    return res.status(200).json({
      success: true,
      data: {
        performance,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAgencyPerformance,
  getAgentPerformance,
};