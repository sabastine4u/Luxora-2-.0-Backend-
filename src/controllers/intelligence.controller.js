const service = require("../services/intelligence.service");
const AppError = require("../utils/AppError");
const { validateQuery } = require("../validators/intelligence.validator");

const get = (method) => async (req, res, next) => {
  try { return res.status(200).json({ status: "success", data: await service[method](validateQuery(req.query)) }); }
  catch (error) { return next(error); }
};
exports.overview = get("getOverview"); exports.counts = get("getCounts");
exports.marketTrends = get("getMarketTrends"); exports.neighborhoods = get("getNeighborhoods");
exports.heatMap = get("getHeatMap"); exports.comparables = get("getComparables");
exports.rentalYield = get("getRentalYield"); exports.growthForecast = get("getGrowthForecast");
exports.investmentScores = get("getInvestmentScores"); exports.riskAnalysis = get("getRiskAnalysis");
exports.reports = get("getReports"); exports.alerts = get("getAlerts");
exports.roiCalculation = async (req, res, next) => {
  try { return res.status(200).json({ status: "success", data: service.calculateROI(req.body) }); }
  catch (error) { return next(error instanceof AppError ? error : new AppError(error.message, 400)); }
};
