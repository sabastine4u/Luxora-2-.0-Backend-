const express = require("express");

const departmentController =
  require("../controllers/department.controller");

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const {
  ROLES,
} = require("../config/constants");

const router = express.Router();

/*
 * Department Oversight
 *
 * This endpoint is available to Manager accounts.
 * Department data is currently derived from the
 * existing User.department records.
 */
router.get(
  "/departments",
  protect,
  restrictTo(ROLES.MANAGER),
  departmentController.getDepartments,
);

module.exports = router;