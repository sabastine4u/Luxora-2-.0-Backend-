const managementOverviewService = require("../services/management-overview.service");

exports.getManagementOverview = async (req, res, next) => {
  try {
    const overview =
      await managementOverviewService.getManagementOverview();

    return res.status(200).json({
      success: true,
      message:
        "Management overview retrieved successfully",
      overview,
    });
  } catch (error) {
    next(error);
  }
};