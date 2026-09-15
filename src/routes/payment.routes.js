const express = require("express");

const {
  createPayment,
  getOwnerPayments,
  getPaymentById,
  updatePaymentStatus,
} = require("../controllers/payment.controller");

// Import the existing authentication and role middleware used by Luxora.
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Import the existing role constants used throughout the backend.
const { ROLES } = require("../config/constants");

const router = express.Router();

// Allow authenticated Owners to manage their rental payment records.
router.use(protect, restrictTo(ROLES.OWNER));

// Create a new rental payment record.
router.post("/", createPayment);

// Retrieve all rental payments belonging to the authenticated Owner.
router.get("/owner", getOwnerPayments);

// Retrieve a single rental payment belonging to the authenticated Owner.
router.get("/:id", getPaymentById);

// Update the status of a rental payment belonging to the authenticated Owner.
router.patch("/:id/status", updatePaymentStatus);

// Export the Payment router for application registration.
module.exports = router;