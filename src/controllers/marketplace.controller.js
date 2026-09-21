const marketplaceService = require("../services/marketplace.service");
const api = require("../utils/api-response");

const getPublicMarketplaceSummary = async (
  req,
  res,
  next,
) => {
  try {
    const summary =
      await marketplaceService.getPublicMarketplaceSummary();

    return api.success(
      res,
      { summary },
      "Public marketplace summary retrieved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

const getPublicInvestmentIntelligence =
  async (req, res, next) => {
    try {
      const intelligence =
        await marketplaceService.getPublicInvestmentIntelligence();

      return api.success(
        res,
        { intelligence },
        "Public investment intelligence retrieved successfully",
      );
    } catch (error) {
      return next(error);
    }
  };

module.exports = {
  getPublicMarketplaceSummary,
  getPublicInvestmentIntelligence,
};