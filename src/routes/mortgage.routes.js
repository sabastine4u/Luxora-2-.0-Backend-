// Import Express so we can create the Mortgage router.
const express = require("express");

// Import the Mortgage controller functions used by the routes.
const {
  createMortgageApplicationController,
  getMyMortgageApplicationsController,
} = require("../controllers/mortgage.controller");

// Import the authentication and role middleware used by protected Buyer routes.
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Import the existing role constants used throughout Luxora.
const { ROLES } = require("../config/constants");

// Create a router for Mortgage Application endpoints.
const router = express.Router();

// Allow only authenticated Buyers to retrieve their Mortgage Applications.
router.get(
  "/my",
  protect,
  restrictTo(ROLES.BUYER),
  getMyMortgageApplicationsController,
);

// Allow only authenticated Buyers to submit a Mortgage Application.
router.post(
  "/",
  protect,
  restrictTo(ROLES.BUYER),
  createMortgageApplicationController,
);

// Export the Mortgage router so it can be mounted in app.js.
module.exports = router;