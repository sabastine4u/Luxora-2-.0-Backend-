const express = require("express");

const protect = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");
const { ROLES } = require("../constants/roles");
const financeController = require("../controllers/finance.controller");

const router = express.Router();

router.get(
  "/admin/finance/summary",
  protect,
  restrictTo(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  financeController.getAdminFinanceSummary,
);

module.exports = router;