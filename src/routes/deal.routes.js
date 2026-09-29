// Import Express so we can create the Deal router.
const express = require("express");

// Import the Deal controller functions.
const {
  getMyDeals,
  getDealById,
  completeAgreement,
  verifyPayment,
  completeDeal,
} = require("../controllers/deal.controller");

// Import the authentication middleware used by protected API routes.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the existing role constants used throughout Luxora.
const { ROLES } = require("../config/constants");

// Create a router for Deal endpoints.
const router = express.Router();

/*
 * Allow authenticated participants and authorized oversight roles
 * to retrieve the Deals they are permitted to see.
 *
 * Super Admin is automatically allowed by restrictTo().
 */
router.get(
  "/my",
  protect,
  restrictTo(
    ROLES.BUYER,
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.AGENCY,
    ROLES.ADMIN,
    ROLES.FINANCE,
  ),
  getMyDeals,
);


// Complete the Agreement stage of a Deal.
router.patch(
  "/:dealId/agreement-complete",
  protect,
  restrictTo(
    ROLES.BUYER,
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.ADMIN,
  ),
  completeAgreement,
);

// Verify payment for an Agreement-completed Deal.
router.patch(
  "/:dealId/payment-verify",
  protect,
  restrictTo(
    ROLES.FINANCE,
    ROLES.ADMIN,
  ),
  verifyPayment,
);

// Finalize a payment-verified Deal.
router.patch(
  "/:dealId/complete",
  protect,
  restrictTo(
    ROLES.FINANCE,
    ROLES.ADMIN,
  ),
  completeDeal,
);


/*
 * Retrieve one Deal.
 *
 * The Deal service performs the final relationship-level authorization,
 * so a valid role alone does not grant access to another user's Deal.
 */
router.get(
  "/:dealId",
  protect,
  restrictTo(
    ROLES.BUYER,
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.AGENCY,
    ROLES.ADMIN,
    ROLES.FINANCE,
  ),
  getDealById,
);

// Export the Deal router so it can be mounted in app.js.
module.exports = router;