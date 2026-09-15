const express = require("express");

// Import the Owner analytics controller.
const {
  getOwnerAnalytics,
} = require("../controllers/analytics.controller");

// Import the existing authentication and role middleware.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the application's role constants.
const { ROLES } = require("../config/constants");

// Create the analytics router.
const router = express.Router();

// Allow only authenticated Owners to access Owner analytics.
router.get(
  "/owner",
  protect,
  restrictTo(ROLES.OWNER),
  getOwnerAnalytics,
);

// Export the analytics router.
module.exports = router;