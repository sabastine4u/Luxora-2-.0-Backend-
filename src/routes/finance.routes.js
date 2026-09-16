const express = require("express");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");
const financeController = require("../controllers/finance.controller");

const router = express.Router();

// This router is mounted at /api/v1 with other domains. Limit the guard to
// /finance so Finance authorization cannot intercept any sibling namespace.
router.use("/finance", protect, restrictTo(ROLES.FINANCE, ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get("/finance/overview", financeController.getOverview);
router.get("/finance/counts", financeController.getCounts);
router.get("/finance/revenue", financeController.getRevenue);
router.get("/finance/transactions", financeController.getTransactions);
router.get("/finance/owner-payments", financeController.getOwnerPayments);
router.get("/finance/agency-earnings", financeController.getAgencyEarnings);
router.get("/finance/agent-commissions", financeController.getAgentCommissions);
router.get("/finance/mortgage-statistics", financeController.getMortgageStatistics);
router.get("/finance/procurement-budget", financeController.getProcurementBudget);
router.get("/finance/reports", financeController.getReports);
router.get("/finance/audit-logs", financeController.getAuditLogs);
router.get("/finance/forecasting", financeController.getForecasting);

module.exports = router;
