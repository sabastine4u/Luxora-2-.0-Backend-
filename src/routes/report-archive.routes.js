const express = require("express");

const reportArchiveController = require(
  "../controllers/report-archive.controller",
);

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const {
  ROLES,
} = require("../config/constants");

const router = express.Router();

// Create an archived report snapshot.
router.post(
  "/admin/reports/archive",
  protect,
  restrictTo(ROLES.ADMIN),
  reportArchiveController.createReportArchive,
);

// Retrieve archived reports for the Past Reports section.
router.get(
  "/admin/reports/archive",
  protect,
  restrictTo(ROLES.ADMIN),
  reportArchiveController.getArchivedReports,
);

// Retrieve one archived report.
router.get(
  "/admin/reports/archive/:id",
  protect,
  restrictTo(ROLES.ADMIN),
  reportArchiveController.getArchivedReportById,
);

module.exports = router;