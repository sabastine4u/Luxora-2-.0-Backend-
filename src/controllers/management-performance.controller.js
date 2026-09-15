const managementPerformanceService =
  require("../services/management-performance.service");

const getManagementPerformance =
  async (req, res, next) => {
    try {
      const performance =
        await managementPerformanceService.getManagementPerformance();

      return res.status(200).json({
        success: true,
        message:
          "Management performance retrieved successfully",
        data: performance,
      });
    } catch (error) {
      next(error);
    }
  };

module.exports = {
  getManagementPerformance,
};