// Create the Express router for Commission endpoints.
const router = require("express").Router();

// Import authentication and role authorization middleware.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the role constants used by the application.
const { ROLES } = require("../config/constants");

// Import the Commission controller.
const commissionController = require("../controllers/commission.controller");

// Allow an authenticated Agency to generate a commission
// from a finalized transaction.
router.post(
  "/agency/commissions/generate",
  protect,
  restrictTo(ROLES.AGENCY),
  commissionController.generateCommission,
);

// Retrieve the authenticated Agency's commission ledger.
router.get(
  "/agency/commissions",
  protect,
  restrictTo(ROLES.AGENCY),
  commissionController.getAgencyCommissions,
);

// Retrieve real commission summary statistics for the Agency.
router.get(
  "/agency/commission-summary",
  protect,
  restrictTo(ROLES.AGENCY),
  commissionController.getAgencyCommissionSummary,
);

// Move one Agency commission from Pending to Processing or cancel it.
router.patch(
  "/agency/commissions/:commissionId/status",
  protect,
  restrictTo(ROLES.AGENCY),
  commissionController.updateAgencyCommissionStatus,
);

// Run payroll for all Agency commissions currently in Processing.
router.post(
  "/agency/commissions/run-payroll",
  protect,
  restrictTo(ROLES.AGENCY),
  commissionController.runAgencyPayroll,
);

// Retrieve the authenticated Agent's commission ledger.
router.get(
  "/agent/commissions",
  protect,
  restrictTo(ROLES.AGENT),
  commissionController.getAgentCommissions,
);

// Retrieve real commission summary statistics for the Agent.
router.get(
  "/agent/commission-summary",
  protect,
  restrictTo(ROLES.AGENT),
  commissionController.getAgentCommissionSummary,
);

// Export the Commission router.
module.exports = router;