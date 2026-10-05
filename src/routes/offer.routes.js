// Import Express so we can create the Offer router.
const express = require("express");

const {
  createOffer,
  getMyOffers,
  getOwnerOffers,
  getAdminOffers,
  getSuperAdminOffers,
  getAgencyOffers,
  getAgentOffers,
  withdrawOffer,
  acceptOffer,
  rejectOffer,
  counterOffer,
  acceptCounterOffer,
  rejectCounterOffer,
  buyerCounterOffer,
} = require("../controllers/offer.controller");

// Import the authentication middleware used by protected API routes.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the existing role constants used throughout Luxora.
const {
  ROLES,
} = require("../config/constants");

// Create a router for Offer endpoints.
const router = express.Router();

// =========================================================
// BUYER
// =========================================================

// Allow only authenticated Buyers to retrieve their own Offers.
router.get(
  "/my",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  getMyOffers,
);

// Allow only authenticated Buyers to create purchase Offers.
router.post(
  "/",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  createOffer,
);

// Allow only authenticated Buyers to withdraw their own active Offers.
router.patch(
  "/:offerId/withdraw",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  withdrawOffer,
);

// Allow authenticated Buyers to accept an Owner/Agent/Admin/Super Admin counter offer.
router.patch(
  "/:offerId/accept-counter",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  acceptCounterOffer,
);

// Allow an authenticated Buyer to respond with a new counter offer.
router.patch(
  "/:offerId/buyer-counter",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  buyerCounterOffer,
);

// Allow authenticated Buyers to reject a counter offer.
router.patch(
  "/:offerId/reject-counter",
  protect,
  restrictTo(
    ROLES.BUYER,
  ),
  rejectCounterOffer,
);

// =========================================================
// OWNER
// =========================================================

// Allow only authenticated Owners to retrieve Offers
// submitted against their Properties.
router.get(
  "/owner",
  protect,
  restrictTo(
    ROLES.OWNER,
  ),
  getOwnerOffers,
);

// =========================================================
// ADMIN / SUPER ADMIN
// =========================================================

// Admin receives Offers only for Properties created
// by that authenticated Admin.
router.get(
  "/admin",
  protect,
  restrictTo(
    ROLES.ADMIN,
  ),
  getAdminOffers,
);

// Super Admin receives Offers only for Properties
// created by that authenticated Super Admin.
router.get(
  "/super-admin",
  protect,
  restrictTo(
    ROLES.SUPER_ADMIN,
  ),
  getSuperAdminOffers,
);

// =========================================================
// AGENCY
// =========================================================

// Allow only authenticated Agencies to retrieve
// Offers belonging to their Agency.
router.get(
  "/agency",
  protect,
  restrictTo(
    ROLES.AGENCY,
  ),
  getAgencyOffers,
);

// =========================================================
// AGENT
// =========================================================

// Allow only authenticated Agents to retrieve
// Offers assigned to them.
router.get(
  "/agent",
  protect,
  restrictTo(
    ROLES.AGENT,
  ),
  getAgentOffers,
);

// =========================================================
// INCOMING OFFER ACTIONS
// =========================================================

// Property Owners, assigned Agents, Admin creators,
// and Super Admin creators may accept incoming Offers.
router.patch(
  "/:offerId/accept",
  protect,
  restrictTo(
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.ADMIN,
    ROLES.SUPER_ADMIN,
  ),
  acceptOffer,
);

// Property Owners, assigned Agents, Admin creators,
// and Super Admin creators may reject incoming Offers.
router.patch(
  "/:offerId/reject",
  protect,
  restrictTo(
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.ADMIN,
    ROLES.SUPER_ADMIN,
  ),
  rejectOffer,
);

// Property Owners, assigned Agents, Admin creators,
// and Super Admin creators may submit counter Offers.
router.patch(
  "/:offerId/counter",
  protect,
  restrictTo(
    ROLES.OWNER,
    ROLES.AGENT,
    ROLES.ADMIN,
    ROLES.SUPER_ADMIN,
  ),
  counterOffer,
);

// Export the Offer router so it can be mounted in app.js.
module.exports = router;