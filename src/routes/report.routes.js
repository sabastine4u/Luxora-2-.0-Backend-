const express = require("express");

const reportController = require("../controllers/report.controller");

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const {
  ROLES,
} = require("../config/constants");

const router = express.Router();

router.get(
  "/admin/reports",
  protect,
  restrictTo(ROLES.ADMIN),
  reportController.getAdminReport,
);

router.get(
  "/management/reports",
  protect,
  restrictTo(ROLES.MANAGER),
  reportController.getManagerReport,
);

module.exports = router;