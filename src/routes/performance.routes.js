// Create the Express router for Agency Performance analytics.
const router = require("express").Router();

// Import the Performance controller.
const performanceController = require("../controllers/performance.controller");

// Import authentication and role restrictions.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the canonical application roles.
const { ROLES } = require("../config/constants");

// Allow only an authenticated Agency to access its Performance dashboard.
router.get(
  "/agency/performance",
  protect,
  restrictTo(ROLES.AGENCY),
  performanceController.getAgencyPerformance,
);

router.get(
  "/agent/performance",
  protect,
  restrictTo(ROLES.AGENT),
  performanceController.getAgentPerformance,
);

// Export the router.
module.exports = router;