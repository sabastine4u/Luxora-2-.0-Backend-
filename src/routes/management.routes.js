const express = require("express");

const managementController =
  require("../controllers/management.controller");

  const managementPerformanceController =
  require("../controllers/management-performance.controller");

  const managementOverviewController = require("../controllers/management-overview.controller");

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const {
  ROLES,
} = require("../config/constants");

const router =
  express.Router();

router.get(
  "/management/team",
  protect,
  restrictTo(
    ROLES.MANAGER,
  ),
  managementController.getManagementTeam,
);

router.get(
  "/management/performance",
  protect,
  restrictTo(ROLES.MANAGER),
  managementPerformanceController.getManagementPerformance,
);

router.get(
  "/management/overview",
  protect,
  restrictTo(ROLES.MANAGER),
  managementOverviewController.getManagementOverview,
);

module.exports = router;