const express = require("express");

// Create the router used by the Inquiry endpoints.
const router = express.Router();

// Import Inquiry controllers.
const inquiryController = require("../controllers/inquiry.controller");

// Import the existing authentication middleware.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the canonical role constants.
const { ROLES } = require("../config/constants");

// Public endpoint used by the Contact Agent form.
router.post(
  "/",
  inquiryController.createInquiry,
);

// Protected Agency endpoint used by the Agency dashboard.
router.get(
  "/agency",
  protect,
  restrictTo(ROLES.AGENCY),
  inquiryController.getAgencyInquiries,
);

// Protected Agent endpoint used by the Agent Lead dashboard.
router.get(
  "/agent",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.getAgentInquiries,
);

// Protected Agent endpoint used by the Agent Clients dashboard.
router.get(
  "/agent/clients",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.getAgentClients,
);

// Return scheduled viewing appointments belonging to the authenticated Agent.
router.get(
  "/agent/appointments",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.getAgentAppointments,
);

// Update the Lead status for the authenticated Agent.
router.patch(
  "/agent/:inquiryId/status",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.updateAgentInquiryStatus,
);

// Update the appointment lifecycle status for the authenticated Agent.
router.patch(
  "/agent/appointments/:inquiryId/status",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.updateAgentAppointmentStatus,
);

// Add a private Agent note to a Lead.
router.post(
  "/agent/:inquiryId/notes",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.addAgentInquiryNote,
);

// Schedule or reschedule a viewing for a Lead.
router.patch(
  "/agent/:inquiryId/schedule-viewing",
  protect,
  restrictTo(ROLES.AGENT),
  inquiryController.scheduleAgentInquiryViewing,
);

// Export the Inquiry router.
module.exports = router;