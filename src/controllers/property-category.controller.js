const propertyCategoryService = require("../services/property-category.service");
const api = require("../utils/api-response");

const getPropertyCategories = async (req, res, next) => {
  try {
    const categories =
      await propertyCategoryService.getPropertyCategories();

    return api.success(
      res,
      { categories },
      "Property categories retrieved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPropertyCategories,
};