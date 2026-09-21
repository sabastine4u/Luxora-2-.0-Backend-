const propertyLocationService = require("../services/property-location.service");
const api = require("../utils/api-response");

const getPropertyLocations = async (req, res, next) => {
  try {
    const locations =
      await propertyLocationService.getPropertyLocations();

    return api.success(
      res,
      { locations },
      "Property locations retrieved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPropertyLocations,
};