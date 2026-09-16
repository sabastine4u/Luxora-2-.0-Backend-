const financeService = require("../services/finance.service");
const { success } = require("../utils/api-response");
const respond = (method, key) => async (req, res, next) => { try { return success(res, { [key]: await financeService[method](req.query) }, "Finance data retrieved successfully"); } catch (error) { next(error); } };
exports.getOverview = respond("getOverview", "overview"); exports.getCounts = respond("getCounts", "counts"); exports.getRevenue = respond("getRevenue", "data"); exports.getTransactions = respond("getTransactions", "data"); exports.getOwnerPayments = respond("getOwnerPayments", "data"); exports.getAgencyEarnings = respond("getAgencyEarnings", "data"); exports.getAgentCommissions = respond("getAgentCommissions", "data"); exports.getMortgageStatistics = respond("getMortgageStatistics", "data"); exports.getProcurementBudget = respond("getProcurementBudget", "data"); exports.getReports = respond("getReports", "reports"); exports.getAuditLogs = respond("getAuditLogs", "data"); exports.getForecasting = respond("getForecasting", "forecasting");

// Preserve the existing Admin Finance contract without creating settings or
// inventing figures. It is intentionally separate from the Finance Manager
// read projections above.
exports.getAdminFinanceSummary = async (req, res, next) => {
  try {
    const Commission = require("../models/commission.model");
    const records = await Commission.find({ status: { $in: ["Pending", "Processing", "Paid", "Overdue"] } }).populate("property", "title").populate("agency", "name").sort({ createdAt: -1 }).limit(25).lean();
    const totalGMV = records.reduce((sum, item) => sum + Number(item.dealValue || 0), 0);
    const revenue = records.reduce((sum, item) => sum + Number(item.commissionPool || 0), 0);
    const pendingAgencyPayouts = records.filter((item) => item.status !== "Paid").reduce((sum, item) => sum + Number(item.agencyAmount || 0), 0);
    return success(res, { summary: { totalGMV, revenue, pendingAgencyPayouts, gmvGrowth: 0, revenueGrowth: 0, platformFeePercent: 0, currency: "NGN" }, transactions: records.map((item) => ({ id: item.commissionId, property: item.property?.title || "Unknown property", agency: item.agency?.name || "Unknown agency", value: Number(item.dealValue || 0), fee: Number(item.commissionPool || 0), status: item.status, createdAt: item.createdAt })) }, "Admin finance summary retrieved successfully");
  } catch (error) { next(error); }
};
