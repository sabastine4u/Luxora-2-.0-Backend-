// Import Express so we can create the Offer router.
const express = require("express");

const {
  createOffer,
  getMyOffers,
  getOwnerOffers,
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
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Import the existing role constants used throughout Luxora.
const { ROLES } = require("../config/constants");

// Create a router for Offer endpoints.
const router = express.Router();

// Allow only authenticated Buyers to retrieve their own Offers.
router.get(
  "/my",
  protect,
  restrictTo(ROLES.BUYER),
  getMyOffers,
);

// Allow only authenticated Owners to retrieve Offers submitted against their Properties.

router.get(
  "/owner",
  protect,
  restrictTo(ROLES.OWNER),
  getOwnerOffers,
);

// Allow authenticated Buyers to accept an Owner's counter offer.
router.patch(
  "/:offerId/accept-counter",
  protect,
  restrictTo(ROLES.BUYER),
  acceptCounterOffer,
);

// Allow an authenticated Buyer to respond with a new counter offer.
router.patch(
  "/:offerId/buyer-counter",
  protect,
  restrictTo(ROLES.BUYER),
  buyerCounterOffer,
);

// Allow authenticated Buyers to reject an Owner's counter offer.
router.patch(
  "/:offerId/reject-counter",
  protect,
  restrictTo(ROLES.BUYER),
  rejectCounterOffer,
);

// Allow only authenticated Agencies to retrieve Offers belonging to their Agency.
router.get(
  "/agency",
  protect,
  restrictTo(ROLES.AGENCY),
  getAgencyOffers,
);
// Allow only authenticated Agents to retrieve Offers assigned to them.
router.get(
  "/agent",
  protect,
  restrictTo(ROLES.AGENT),
  getAgentOffers,
);

// Allow authenticated Owners to accept incoming Offers on their Properties.
router.patch(
  "/:offerId/accept",
  protect,
  restrictTo(ROLES.OWNER),
  acceptOffer,
);

// Allow authenticated Owners to reject incoming Offers on their Properties.
router.patch(
  "/:offerId/reject",
  protect,
  restrictTo(ROLES.OWNER),
  rejectOffer,
);

// Allow authenticated Owners to submit counter Offers to Buyers.
router.patch(
  "/:offerId/counter",
  protect,
  restrictTo(ROLES.OWNER),
  counterOffer,
);

// Allow only authenticated Buyers to create purchase Offers.
router.post(
  "/",
  protect,
  restrictTo(ROLES.BUYER),
  createOffer,
);

// Allow only authenticated Buyers to withdraw their own active Offers.
router.patch(
  "/:offerId/withdraw",
  protect,
  restrictTo(ROLES.BUYER),
  withdrawOffer,
);

// Export the Offer router so it can be mounted in app.js.
module.exports = router;