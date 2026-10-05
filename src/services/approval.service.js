// Import the Approval model used to store Property review records.
const Approval = require("../models/approval.model");

// Import the Property model whose lifecycle state is updated during approval.
const Property = require("../models/property.model");

// Import the dedicated Agent model for Agent-specific ownership checks.
const Agent = require("../models/agent.model");

// Import the centralized application error class for controlled business errors.
const AppError = require("../utils/AppError");

// Define the roles that are allowed to submit Properties for review.
const PROPERTY_SUBMITTER_ROLES = ["Agent", "Admin", "Super Admin"];

// Define the roles that are allowed to review Property approval requests.
const PROPERTY_REVIEWER_ROLES = ["Admin", "Super Admin"];

// Submit an existing Property for the Luxora approval process.
const submitPropertyForReview = async (propertyId, authenticatedUser) => {
  // Ensure that authentication information is available before continuing.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required to submit a property for review",
      401,
    );
  }

  // Ensure that the authenticated role is allowed to submit a Property.
  if (!PROPERTY_SUBMITTER_ROLES.includes(authenticatedUser.role)) {
    throw new AppError(
      "You do not have permission to submit a property for review",
      403,
    );
  }

  // Retrieve the Property that is being submitted for review.
  const property = await Property.findById(propertyId);

  // Stop if the Property does not exist.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Prevent a Property from being submitted again while it is already under review.
  if (property.status === "Pending Review") {
    throw new AppError("Property is already pending review", 409);
  }

  // Prevent already approved, published, or completed Properties from being resubmitted.
  if (
    [
      "Approved",
      "Published",
      "Under Offer",
      "Sold",
      "Rented",
      "Leased",
      "Archived",
    ].includes(property.status)
  ) {
    throw new AppError(
      "This Property cannot be submitted for review from its current status",
      409,
    );
  }

  // Ensure an Agent can only submit a Property belonging to that Agent.
  if (authenticatedUser.role === "Agent") {
    // Find the Agent profile belonging to the authenticated User.
    const agentProfile = await Agent.findOne({
      user: authenticatedUser._id,
    }).select("_id");

    // Reject the request when the authenticated User has no Agent profile.
    if (!agentProfile) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Prevent the Agent from submitting another Agent's Property.
    if (
      !property.agent ||
      property.agent.toString() !== agentProfile._id.toString()
    ) {
      throw new AppError(
        "You can only submit your own Properties for review",
        403,
      );
    }

    // Owner-originated Properties must complete the full
    // Agency -> Agent assignment workflow before review.
    if (property.origin === "owner") {
      if (property.assignmentStatus !== "Agent Accepted") {
        throw new AppError(
          "This Owner property must be accepted by the assigned Agent before it can be submitted for review",
          409,
        );
      }
    }

    // Agent-created Properties follow the direct Agent
    // listing workflow and do not require an assignment.
    else if (property.origin === "agent") {
      // No Agency assignment state is required for
      // an Agent-created Property.
    }

    // Prevent an Agent from submitting properties
    // belonging to an unrelated creation workflow.
    else {
      throw new AppError(
        "This Property is not eligible for Agent review submission",
        409,
      );
    }
  }

  // Find whether the Property already has a pending Approval record.
  let approval = await Approval.findOne({
    property: property._id,
    status: "Pending",
  });

  // Create a new Approval record when none is currently pending.
  if (!approval) {
    approval = await Approval.create({
      property: property._id,
      submittedBy: authenticatedUser._id,
      submittedByRole: authenticatedUser.role,
      status: "Pending",
    });
  }

  // Move the Property into the review lifecycle state.
  property.status = "Pending Review";

  // Save the updated Property state in MongoDB.
  await property.save();

  // Return both records so the controller can present the updated state.
  return {
    property,
    approval,
  };
};

// Review a pending Property approval request.
const reviewPropertyApproval = async (
  propertyId,
  authenticatedUser,
  decision,
  reviewNotes,
) => {
  // Ensure that authentication information is available.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required to review a property",
      401,
    );
  }

  // Ensure the requested approval decision is supported.
  if (!["Approved", "Rejected"].includes(decision)) {
    throw new AppError(
      "Approval decision must be Approved or Rejected",
      400,
    );
  }

  // Retrieve the Property being reviewed.
  const property = await Property.findById(propertyId);

  // Stop if the Property cannot be found.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  /*
   * Admin-created Properties require Super Admin review.
   *
   * Admin-created listings must never be approved or
   * rejected by an Admin.
   */
  if (property.createdByRole === "Admin") {
    if (authenticatedUser.role !== "Super Admin") {
      throw new AppError(
        "Only a Super Admin can review an Admin-created Property",
        403,
      );
    }
  }

  /*
   * Agent and other supported review workflows remain
   * available to Admin and Super Admin.
   *
   * Super Admin-created Properties normally never reach
   * this function because they are published immediately.
   */
  else {
    if (!["Admin", "Super Admin"].includes(authenticatedUser.role)) {
      throw new AppError(
        "You do not have permission to review property approvals",
        403,
      );
    }
  }

  // Retrieve the pending Approval record associated with the Property.
  const approval = await Approval.findOne({
    property: property._id,
    status: "Pending",
  });

  // Do not allow a review when no pending approval exists.
  if (!approval) {
    throw new AppError(
      "No pending approval request exists for this Property",
      404,
    );
  }

  // Prevent the same User who submitted the Property from approving their own submission.
  if (
    String(approval.submittedBy) ===
    String(authenticatedUser._id)
  ) {
    throw new AppError(
      "A Property cannot be approved by the same User who submitted it",
      403,
    );
  }

  // Store the review decision made by the authenticated reviewer.
  approval.status = decision;

  // Record who made the approval decision.
  approval.reviewedBy = authenticatedUser._id;

  // Record when the approval decision was made.
  approval.reviewedAt = new Date();

  // Store the reviewer's explanation when one was supplied.
  approval.reviewNotes = reviewNotes || null;

  // Save the approval decision in MongoDB.
  await approval.save();

  /*
   * Move the Property to the appropriate lifecycle state
   * and keep the verification state aligned with the review decision.
   */
  if (decision === "Approved") {
    property.status = "Approved";

    // Approval confirms that the submitted
    // Property documents were reviewed.
    property.verificationLevel = "Documents Verified";
  } else {
    property.status = "Draft";

    // A rejected Property returns to the
    // unverified state.
    property.verificationLevel = "Unverified";
  }

  // Save the updated Property lifecycle state.
  await property.save();

  // Return both updated records to the controller.
  return {
    property,
    approval,
  };
};

// Publish a Property to the public Luxora marketplace.
const publishProperty = async (propertyId, authenticatedUser) => {
  // Ensure that authenticated user information is available.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required to publish a property",
      401,
    );
  }

  // Retrieve the Property that is being published.
  const property = await Property.findById(propertyId);

  // Stop if the Property does not exist.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Prevent an already published Property from being published again.
  if (property.status === "Published") {
    throw new AppError(
      "Property is already published",
      409,
    );
  }

  /*
   * Admin-created Properties can only be
   * published by a Super Admin.
   */
  if (property.createdByRole === "Admin") {
    if (authenticatedUser.role !== "Super Admin") {
      throw new AppError(
        "Only a Super Admin can publish an Admin-created Property",
        403,
      );
    }

    // Admin-created Properties must complete
    // the approval workflow before publication.
    if (property.status !== "Approved") {
      throw new AppError(
        "Only approved properties can be published",
        409,
      );
    }
  }

  /*
   * Super Admin-created Properties normally become
   * Published immediately during creation.
   *
   * This branch also repairs legacy Draft Super Admin
   * properties created before that workflow was introduced.
   */
  else if (property.createdByRole === "Super Admin") {
    if (authenticatedUser.role !== "Super Admin") {
      throw new AppError(
        "Only a Super Admin can publish a Super Admin-created Property",
        403,
      );
    }

    const isLegacySuperAdminProperty =
      property.status === "Draft" &&
      String(property.createdBy) ===
        String(authenticatedUser._id);

    // A legacy Draft listing may be published directly
    // only by the Super Admin who created it.
    if (
      !isLegacySuperAdminProperty &&
      property.status !== "Approved"
    ) {
      throw new AppError(
        "Only approved properties can be published",
        409,
      );
    }
  }

  /*
   * Other approved Properties follow the
   * existing Admin / Super Admin workflow.
   */
  else {
    if (!["Admin", "Super Admin"].includes(authenticatedUser.role)) {
      throw new AppError(
        "You do not have permission to publish properties",
        403,
      );
    }

    if (property.status !== "Approved") {
      throw new AppError(
        "Only approved properties can be published",
        409,
      );
    }
  }

  // Move the Property into the public marketplace lifecycle state.
  property.status = "Published";

  // Published Properties become available.
  property.availabilityStatus = "Available";

  // Save the publication state in MongoDB.
  await property.save();

  // Return the newly published Property.
  return property;
};

// Export the complete Property approval and publishing service.
module.exports = {
  submitPropertyForReview,
  reviewPropertyApproval,
  publishProperty,
};