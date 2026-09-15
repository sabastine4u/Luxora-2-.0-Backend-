const express = require("express");

const auditLogController =
  require("../controllers/audit-log.controller");

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
  "/admin/audit-logs",
  protect,
  restrictTo(ROLES.ADMIN),
  auditLogController.getAdminAuditLogs,
);

module.exports = router;