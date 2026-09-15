// Create an Express router for Property approval workflow endpoints.
const router = require("express").Router();

// Import the Property approval controller.
const approvalController = require("../controllers/approval.controller");

// Import the authentication middleware used to protect approval actions.
const { protect } = require("../middleware/auth.middleware");

// Allow authenticated Property creators to submit their Properties for review.
// The approval service performs the final role and ownership checks.
router.post(
  "/properties/:propertyId/submit-review",
  protect,
  approvalController.submitPropertyForReview,
);

// Allow authenticated reviewers to approve or reject a Property.
// The approval service restricts this operation to Admin and Super Admin.
router.patch(
  "/properties/:propertyId/approval",
  protect,
  approvalController.reviewPropertyApproval,
);

// Publish an approved Property to the public marketplace.
// The service enforces that only Admin and Super Admin can perform this action.
router.patch(
  "/properties/:propertyId/publish",
  protect,
  approvalController.publishProperty,
);

// Export the Approval router so it can be mounted by the Express application.
module.exports = router;
