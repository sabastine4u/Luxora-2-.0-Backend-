// Create an Express router for Property-related endpoints.
const router = require("express").Router();

// Import the Property controller that handles Property HTTP requests.
const propertyController = require("../controllers/property.controller");

// Import authentication and role-restriction middleware for protected Property routes.
const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

// Import the application's canonical role constants.
const { ROLES } = require("../config/constants");

// Allow authenticated users to create a Property.
// The controller and service layers perform the final authorization checks.
router.post(
  "/properties",
  protect,
  propertyController.createProperty,
);

// Retrieve all Properties belonging to the authenticated Owner.
router.get(
  "/owner/properties",
  protect,
  propertyController.getOwnerProperties,
);

// Allow the authenticated Owner to withdraw their own active Property request.
router.patch(
  "/owner/properties/:propertyId/withdraw",
  protect,
  restrictTo(ROLES.OWNER),
  propertyController.withdrawOwnerProperty,
);

// Allow an authenticated Agency to retrieve Properties assigned to its Agency.
router.get(
  "/agency/properties",
  protect,
  propertyController.getAgencyProperties,
);

// Retrieve real PropertyView analytics for the authenticated Agency.
router.get(
  "/agency/property-analytics",
  protect,
  restrictTo(ROLES.AGENCY),
  propertyController.getAgencyPropertyAnalytics,
);

// Retrieve Properties currently assigned to the authenticated Agent
// and waiting for the Agent's response.
router.get(
  "/agent/properties",
  protect,
  restrictTo(ROLES.AGENT),
  propertyController.getAgentProperties,
);

// Retrieve Properties that the authenticated Agent has accepted for active management.
router.get(
  "/agent/listings",
  protect,
  restrictTo(ROLES.AGENT),
  propertyController.getAgentListings,
);

// Allow the authenticated Agent to accept one of their pending assignments.
router.patch(
  "/agent/properties/:propertyId/accept",
  protect,
  restrictTo(ROLES.AGENT),
  propertyController.acceptPropertyAssignment,
);

// Allow the authenticated Agent to decline one of their pending assignments.
router.patch(
  "/agent/properties/:propertyId/decline",
  protect,
  restrictTo(ROLES.AGENT),
  propertyController.declinePropertyAssignment,
);

// No authentication is required because published Properties are public.
router.get(
  "/properties",
  propertyController.getProperties,
);



// Allow Admin and Super Admin users to assign a Property to an Agency.
// The service layer performs the final role and business-rule checks.
router.patch(
  "/properties/:propertyId/assign-agency",
  protect,
  propertyController.assignPropertyToAgency,
);

// Allow an authenticated Agency to decline a Property assignment.
router.patch(
  "/properties/:propertyId/decline-agency",
  protect,
  restrictTo(ROLES.AGENCY),
  propertyController.declinePropertyForAgency,
);


// Allow only Admin and Super Admin users to assign the operational manager.
// The Property service repeats the authorization and validates the target User.
router.patch(
  "/properties/:propertyId/assign-property-manager",
  protect,
  restrictTo(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  propertyController.assignPropertyToManager,
);

// Allow an authenticated Agency to update a Property belonging to that Agency.
router.patch(
  "/properties/:propertyId",
  protect,
  propertyController.updateAgencyProperty,
);

// Allow Agency users to assign or reassign a Property to an Agent.
// The service layer verifies Agency ownership and Agent membership.
router.patch(
  "/properties/:propertyId/assign-agent",
  protect,
  propertyController.assignPropertyToAgent,
);

// Record a public Property detail-page view.
router.post(
  "/properties/:id/view",
  propertyController.recordPropertyView,
);

// Allow the authenticated Owner to attach uploaded documents to their own Property.
router.patch(
  "/properties/:propertyId/documents",
  protect,
  restrictTo(ROLES.OWNER),
  propertyController.addOwnerPropertyDocuments,
);

// Retrieve one published Property for the public Property Details page.
router.get(
  "/properties/:id",
  propertyController.getPropertyById,
);

// Export the Property router so Express can mount it.
module.exports = router;
