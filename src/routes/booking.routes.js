// Import Express so we can create the Booking router.
const express = require("express");
// Import the Booking controller functions that handle viewing requests.
const {
  createBooking,
  getMyBookings,
  getAgencyBookings,
  getAgentBookings,
  cancelBooking,
  rescheduleBooking,
  confirmAgentBooking,
  rejectAgentBooking,
  completeAgentBooking,
} = require("../controllers/booking.controller");

// Import the authentication middleware used by protected API routes.
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Import the existing role constants used throughout Luxora.
const { ROLES } = require("../config/constants");

// Create a router for Booking endpoints.
const router = express.Router();

// Allow only authenticated Buyers to retrieve their viewing requests.
router.get(
  "/my",
  protect,
  restrictTo(ROLES.BUYER),
  getMyBookings,
);

// Allow authenticated Agencies to retrieve viewing requests for their properties.
router.get(
  "/agency",
  protect,
  restrictTo(ROLES.AGENCY),
  getAgencyBookings,
);

// Allow authenticated Agents to retrieve viewing requests
// for properties currently assigned to them.
router.get(
  "/agent",
  protect,
  restrictTo(ROLES.AGENT),
  getAgentBookings,
);

// Allow an authenticated Agent to confirm
// a viewing request assigned to that Agent.
router.patch(
  "/:bookingId/confirm",
  protect,
  restrictTo(ROLES.AGENT),
  confirmAgentBooking,
);

// Allow an authenticated Agent to reject
// a pending viewing request assigned to them.
router.patch(
  "/:bookingId/reject",
  protect,
  restrictTo(ROLES.AGENT),
  rejectAgentBooking,
);

// Allow an authenticated Agent to mark
// a confirmed viewing as completed.
router.patch(
  "/:bookingId/complete",
  protect,
  restrictTo(ROLES.AGENT),
  completeAgentBooking,
);

// Allow only authenticated Buyers to create viewing requests.
router.post(
  "/",
  protect,
  restrictTo(ROLES.BUYER),
  createBooking,
);

// Allow only authenticated Buyers to cancel their own viewing request.
router.patch(
  "/:bookingId/cancel",
  protect,
  restrictTo(ROLES.BUYER),
  cancelBooking,
);

// Allow only authenticated Buyers to reschedule their own viewing request.
router.patch(
  "/:bookingId/reschedule",
  protect,
  restrictTo(ROLES.BUYER),
  rescheduleBooking,
);

// Export the Booking router so it can be mounted in app.js.
module.exports = router;