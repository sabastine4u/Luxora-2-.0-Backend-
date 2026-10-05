// Import the Property model used to persist Property records in MongoDB.
const Property = require("../models/property.model");

// Import Favorite so Agent listing analytics can report real Property saves.
const Favorite = require("../models/favorite.model");

// Import Offer so Agent listing analytics can report real Property offers.
const Offer = require("../models/offer.model");

// Import the PropertyView model used to record marketplace view events.
const PropertyView = require("../models/property-view.model");

// Import the dedicated Agency model used to validate Agency assignments.
const Agency = require("../models/agency.model");

// Import the dedicated Agent model used for Agent-specific relationships.
const Agent = require("../models/agent.model");

// Import User so Admins can assign only real Property Manager accounts.
const User = require("../models/user.model");

// Import Deal so a Property with transaction history cannot be hard-deleted.
const Deal = require("../models/deal.model");

// Import Booking so related viewing records can be cleaned up when
// an administrative Property deletion is explicitly requested.
const Booking = require("../models/booking.model");

// Import Inquiry so related lead records can be cleaned up when
// an administrative Property deletion is explicitly requested.
const Inquiry = require("../models/inquiry.model");


// Import Approval so Admin-created listings can enter the
// Super Admin approval workflow immediately.
const Approval = require("../models/approval.model");

// Import the application error class used for controlled business errors.
const AppError = require("../utils/AppError");

// Import the Property search service used to build marketplace queries.
const searchService = require("./search.service");

// Define the roles that are allowed to create Property records.
const PROPERTY_CREATOR_ROLES = [
  "Owner",
  "Agent",
  "Admin",
  "Super Admin",
];

// Create a new Property using the authenticated user's identity and role.
const createProperty = async (
  propertyData,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided by the protected route.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required to create a property",
      401,
    );
  }

  // Check whether the authenticated role is allowed to create a Property.
  if (
    !PROPERTY_CREATOR_ROLES.includes(
      authenticatedUser.role,
    )
  ) {
    throw new AppError(
      "You do not have permission to create a property",
      403,
    );
  }

  /*
   * Build the Property payload using validated data
   * and server-controlled creator fields.
   */
  const propertyPayload = {
    ...propertyData,

    // Record the authenticated User as the true creator.
    createdBy:
      authenticatedUser._id,

    // Never trust the creator role from the frontend.
    createdByRole:
      authenticatedUser.role,

    // Store normalized search values.
    propertyTypeNormalized:
      propertyData.propertyType
        ?.trim()
        .toLowerCase(),

    stateNormalized:
      propertyData.state
        ?.trim()
        .toLowerCase(),

    cityNormalized:
      propertyData.city
        ?.trim()
        .toLowerCase(),
  };

  /*
   * Set the business origin from the authenticated
   * creator role.
   */
  if (
    authenticatedUser.role ===
    "Owner"
  ) {
    propertyPayload.origin =
      "owner";

    propertyPayload.owner =
      authenticatedUser._id;
  } else if (
    authenticatedUser.role ===
    "Agent"
  ) {
    propertyPayload.origin =
      "agent";
  } else if (
    authenticatedUser.role ===
    "Admin"
  ) {
    propertyPayload.origin =
      "admin";
  } else {
    propertyPayload.origin =
      "luxora";
  }

  /*
   * Handle Agent-created Properties.
   */
  if (
    authenticatedUser.role ===
    "Agent"
  ) {
    const agentProfile =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency",
      );

    if (!agentProfile) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    propertyPayload.agent =
      agentProfile._id;

    if (agentProfile.agency) {
      propertyPayload.agency =
        agentProfile.agency;
    }

    /*
     * Agent-created Properties enter the
     * review workflow after the frontend calls
     * submitPropertyForReview().
     */
    propertyPayload.status =
      "Draft";

    propertyPayload.assignmentStatus =
      null;
  }

  /*
   * Owner-created Properties begin in the
   * Agency Assignment workflow.
   */
  if (
    authenticatedUser.role ===
    "Owner"
  ) {
    propertyPayload.status =
      "Draft";

    propertyPayload.assignmentStatus =
      "Pending Agency Assignment";
  }

  /*
   * Admin-created Properties must immediately
   * enter the Super Admin approval queue.
   *
   * The Admin does NOT approve or publish
   * their own listing.
   */
  if (
    authenticatedUser.role ===
    "Admin"
  ) {
    propertyPayload.status =
      "Pending Review";

    propertyPayload.assignmentStatus =
      null;
  }

  /*
   * Super Admin is the highest platform authority.
   *
   * Their own listings do not require a separate
   * approval step and become marketplace-published
   * immediately after creation.
   */
  if (
    authenticatedUser.role ===
    "Super Admin"
  ) {
    propertyPayload.status =
      "Published";

    propertyPayload.assignmentStatus =
      null;

    propertyPayload.availabilityStatus =
      "Available";
  }

  /*
   * Create the Property record.
   */
  const property =
    await Property.create(
      propertyPayload,
    );

  /*
   * Admin-created Properties need a real
   * Approval record because the Super Admin
   * will review them.
   */
  if (
    authenticatedUser.role ===
    "Admin"
  ) {
    await Approval.create({
      property:
        property._id,

      submittedBy:
        authenticatedUser._id,

      submittedByRole:
        authenticatedUser.role,

      status:
        "Pending",
    });
  }

  // Return the newly created Property.
  return property;
};

// Fetch publicly visible Properties using the dedicated search service.
const getProperties = async (
  query = {},
) => {
  // Delegate filtering, sorting, and pagination to the dedicated search service.
  const result =
    await searchService.searchProperties(
      query,
    );

  // Return the complete search result, including pagination metadata.
  return result;
};

// Fetch all Properties belonging to the authenticated Owner.
const getOwnerProperties = async (
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Owners can access their private Property Requests.
  if (
    authenticatedUser.role !==
    "Owner"
  ) {
    throw new AppError(
      "Only Owners can access their property requests",
      403,
    );
  }

  // Find only Properties whose Owner relationship belongs to the authenticated User.
  const properties =
    await Property.find({
      owner:
        authenticatedUser._id,
    })
      // Populate the Agent profile assigned to the Property.
      .populate({
        path: "agent",
        select:
          "user agency status",
        populate: {
          // Populate the User account connected to the Agent profile.
          path: "user",
          select:
            "fullName email",
        },
      })
      // Populate the Agency assigned to the Property.
      .populate({
        path: "agency",
        select: "name status",
      })
      // Keep Owner requests ordered with the newest submissions first.
      .sort({
        createdAt: -1,
      });

  // Return the Owner's complete Property collection.
  return properties;
};

// Attach uploaded document references to an Owner's Property.
const addOwnerPropertyDocuments =
  async (
    propertyId,
    documents,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Owners can attach documents through the Owner dashboard workflow.
    if (
      authenticatedUser.role !==
      "Owner"
    ) {
      throw new AppError(
        "Only Owners can upload documents for their property requests",
        403,
      );
    }

    // Find the Property and make sure it belongs to the authenticated Owner.
    const property =
      await Property.findOne({
        _id: propertyId,
        owner:
          authenticatedUser._id,
      });

    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // Owner documents are part of the submission/review stages only.
    if (
      ![
        "Draft",
        "Pending Review",
      ].includes(property.status)
    ) {
      throw new AppError(
        "Documents can only be added while the property is in Draft or Pending Review status",
        409,
      );
    }

    // Require at least one document reference from the authenticated upload flow.
    if (
      !Array.isArray(
        documents,
      ) ||
      documents.length === 0
    ) {
      throw new AppError(
        "At least one document is required",
        400,
      );
    }

    // Validate every document before changing the stored Property.
    const normalizedDocuments =
      documents.map(
        (document, index) => {
          const title =
            String(
              document?.title ||
                "",
            ).trim();

          const url =
            String(
              document?.url || "",
            ).trim();

          if (
            !title ||
            !url
          ) {
            throw new AppError(
              `Document ${
                index + 1
              } must include a title and URL`,
              400,
            );
          }

          return {
            title,
            url,
            verified: false,
            uploadedAt:
              new Date(),
          };
        },
      );

    // Append the newly uploaded documents to the Property's existing document set.
    property.documents.push(
      ...normalizedDocuments,
    );

    // Save the Property so the Owner dashboard and verification workflow can read the documents later.
    await property.save();

    // Return the updated Property record.
    return property;
  };

// Withdraw an Owner-submitted Property request without deleting its database record.
const withdrawOwnerProperty =
  async (
    propertyId,
    authenticatedUser,
  ) => {
    // Only an authenticated Owner can perform this workflow action.
    if (
      !authenticatedUser?._id ||
      authenticatedUser.role !==
        "Owner"
    ) {
      throw new AppError(
        "Only Owners can withdraw their property requests",
        403,
      );
    }

    // Find only a Property that belongs to the authenticated Owner
    // and originated from the Owner submission workflow.
    const property =
      await Property.findOne({
        _id: propertyId,
        owner:
          authenticatedUser._id,
        origin: "owner",
      });

    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // A withdrawn request cannot be withdrawn again.
    if (
      property.status ===
      "Archived"
    ) {
      throw new AppError(
        "This property request has already been withdrawn",
        409,
      );
    }

    // Do not allow withdrawal after the listing has already become
    // a live marketplace property.
    const withdrawableStatuses = [
      "Draft",
      "Pending Review",
    ];

    if (
      !withdrawableStatuses.includes(
        property.status,
      )
    ) {
      throw new AppError(
        "This property request can no longer be withdrawn at its current stage",
        409,
      );
    }

    // Archive the record rather than deleting it so Luxora keeps
    // the original submission for audit/history purposes.
    property.status =
      "Archived";

    property.withdrawnAt =
      new Date();

    property.withdrawnBy =
      authenticatedUser._id;

    await property.save();

    return property;
  };

// Fetch one publicly visible Property by its MongoDB ID.
const getPropertyById = async (
  propertyId,
) => {
  // Find the Property only when it has been published to the marketplace.
  const property =
    await Property.findOne({
      _id: propertyId,
      status: "Published",
    })
      .populate({
        path: "agent",
        select:
          "user agency",
        populate: {
          // Populate the User account linked to the Agent profile.
          path: "user",
          select:
            "fullName email",
        },
      })
      // Populate the associated Agency details used by the public Property page.
      .populate({
        path: "agency",
        select: "name",
      })
      // Populate the associated Owner identity only when the relationship exists.
      .populate({
        path: "owner",
        select:
          "fullName email",
      });

  // Return null when the Property does not exist or is not publicly published.
  return property;
};

// Record a public Property detail-page view.
const recordPropertyView =
  async (
    propertyId,
    visitorId,
  ) => {
    // Require the anonymous visitor identifier from the frontend.
    if (!visitorId) {
      throw new AppError(
        "Visitor ID is required to record a property view",
        400,
      );
    }

    // Ensure only publicly published Properties generate marketplace views.
    const property =
      await Property.findOne({
        _id: propertyId,
        status: "Published",
      }).select("_id");

    // Stop when the Property does not exist or is not publicly published.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // Check whether this visitor viewed the same Property within the last 30 minutes.
    const recentView =
      await PropertyView.findOne({
        property:
          propertyId,
        visitorId,
        viewedAt: {
          $gte:
            new Date(
              Date.now() -
                30 *
                  60 *
                  1000,
            ),
        },
      });

    // Avoid counting repeated refreshes as new views within the cooldown window.
    if (recentView) {
      return {
        recorded: false,
        view:
          recentView,
      };
    }

    // Store the new real Property view event.
    const view =
      await PropertyView.create({
        property:
          propertyId,
        visitorId,
      });

    // Return the recording result to the controller.
    return {
      recorded: true,
      view,
    };
  };

// Assign a Property to an Agency.
// Only Admin and Super Admin users are allowed to perform this operation.
const assignPropertyToAgency =
  async (
    propertyId,
    agencyId,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Admin and Super Admin can assign Properties to Agencies.
    if (
      ![
        "Admin",
        "Super Admin",
      ].includes(
        authenticatedUser.role,
      )
    ) {
      throw new AppError(
        "Only Admin and Super Admin can assign a property to an agency",
        403,
      );
    }

    // Find the Property that is being assigned.
    const property =
      await Property.findById(
        propertyId,
      );

    // Stop when the Property does not exist.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // Only Owner-originated Properties enter the
    // Admin/Super Admin -> Agency assignment workflow.
    if (
      property.origin !==
      "owner"
    ) {
      throw new AppError(
        "Only Owner-submitted properties can be assigned to an agency",
        409,
      );
    }

    // The Property must still be waiting for its initial Agency assignment.
    if (
      ![
        "Pending Agency Assignment",
        "Agency Declined",
        "Agency Assigned",
      ].includes(
        property.assignmentStatus,
      )
    ) {
      throw new AppError(
        "This Property cannot be assigned to an Agency in its current workflow state",
        409,
      );
    }

    // Owner properties must still be in Draft before Agency assignment.
    if (
      property.status !==
      "Draft"
    ) {
      throw new AppError(
        "Only Draft Owner properties can be assigned to an agency",
        409,
      );
    }

    // Find the Agency that will receive the Property.
    const agency =
      await Agency.findById(
        agencyId,
      );

    // Prevent reassigning the Property to the same Agency that declined it.
    if (
      property.assignmentStatus ===
        "Agency Declined" &&
      property.agency &&
      property.agency.toString() ===
        agencyId.toString()
    ) {
      throw new AppError(
        "You cannot reassign the property to the same agency that declined it",
        409,
      );
    }

    // Stop when the Agency does not exist.
    if (!agency) {
      throw new AppError(
        "Agency not found",
        404,
      );
    }

    // Prevent Properties from being assigned to a suspended Agency.
    if (
      agency.status !==
      "Active"
    ) {
      throw new AppError(
        "Cannot assign a property to a suspended agency",
        400,
      );
    }

    // Assign the Property to the selected Agency.
    property.agency =
      agency._id;

    // Clear any previous Agent assignment because the Agency will choose the Agent.
    property.agent = null;

    // Move the Property to the Agency-assignment stage.
    property.assignmentStatus =
      "Agency Assigned";

    // Record the User who performed the assignment.
    property.assignedBy =
      authenticatedUser._id;

    // Record when the assignment occurred.
    property.assignedAt =
      new Date();

    // Clear any previous Agent response because this starts a new assignment cycle.
    property.assignmentRespondedBy =
      null;

    property.assignmentRespondedAt =
      null;

    property.assignmentResponseNote =
      null;

    // Save the updated Property.
    await property.save();

    // Return the updated Property.
    return property;
  };

// Allow the authenticated Agency to decline an Owner-submitted Property assignment.
const declinePropertyForAgency =
  async (
    propertyId,
    reason,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agency users can decline Agency assignments.
    if (
      authenticatedUser.role !==
      "Agency"
    ) {
      throw new AppError(
        "Only an Agency can decline a property assignment",
        403,
      );
    }

    // Normalize the Agency's rejection reason.
    const responseNote =
      typeof reason ===
      "string"
        ? reason.trim()
        : "";

    // A reason is mandatory for an Agency rejection.
    if (!responseNote) {
      throw new AppError(
        "A reason is required when declining a property assignment",
        400,
      );
    }

    // Find the Agency linked to the authenticated User.
    const agency =
      await Agency.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id status",
      );

    if (!agency) {
      throw new AppError(
        "Agency profile not found for the authenticated user",
        404,
      );
    }

    // Only Active Agencies can respond to assignments.
    if (
      agency.status !==
      "Active"
    ) {
      throw new AppError(
        "A suspended agency cannot decline property assignments",
        403,
      );
    }

    // Only the currently assigned Agency can decline this assignment.
    const property =
      await Property.findOne({
        _id: propertyId,
        agency:
          agency._id,
        origin:
          "owner",
        status:
          "Draft",
        assignmentStatus:
          "Agency Assigned",
      });

    if (!property) {
      throw new AppError(
        "Property assignment not found or no longer awaiting an Agency response",
        404,
      );
    }

    // Record the Agency rejection.
    property.assignmentStatus =
      "Agency Declined";

    // Record the Agency User who rejected the assignment.
    property.assignmentRespondedBy =
      authenticatedUser._id;

    // Record when the Agency responded.
    property.assignmentRespondedAt =
      new Date();

    // Store the rejection reason.
    property.assignmentResponseNote =
      responseNote;

    // There should not be an Agent attached at this stage.
    property.agent = null;

    await property.save();

    return property;
  };

// Assign or reassign a Property to an Agent.
// Only the Agency responsible for the Property can perform this operation.
const assignPropertyToAgent =
  async (
    propertyId,
    agentId,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agency users can assign or reassign Agents.
    if (
      authenticatedUser.role !==
      "Agency"
    ) {
      throw new AppError(
        "Only an Agency can assign or reassign a property to an agent",
        403,
      );
    }

    // Find the Property that is being assigned.
    const property =
      await Property.findById(
        propertyId,
      );

    // Stop when the Property does not exist.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // Ensure the Property already has an Agency assigned.
    if (!property.agency) {
      throw new AppError(
        "This property has not been assigned to an agency",
        400,
      );
    }

    // Agency assignment is only valid for the Owner workflow.
    if (
      property.origin !==
      "owner"
    ) {
      throw new AppError(
        "Only Owner-submitted properties can be assigned through the Agency workflow",
        409,
      );
    }

    // A new Agent assignment must begin after the Agency
    // has accepted ownership of the property assignment.
    // Agent Declined is also allowed so the Agency can reassign
    // the property to another Agent.
    if (
      property.assignmentStatus !==
        "Agency Assigned" &&
      property.assignmentStatus !==
        "Agent Declined"
    ) {
      throw new AppError(
        "This Property is not ready for Agent assignment",
        409,
      );
    }

    // The property itself should still be in Draft.
    if (
      property.status !==
      "Draft"
    ) {
      throw new AppError(
        "Only Draft Owner properties can be assigned to an agent",
        409,
      );
    }

    // Find the Agency profile linked to the authenticated Agency User.
    const agency =
      await Agency.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id status",
      );

    // Stop when the authenticated Agency User has no Agency profile.
    if (!agency) {
      throw new AppError(
        "Agency profile not found for the authenticated user",
        403,
      );
    }

    // Ensure the authenticated Agency owns the Property assignment.
    if (
      property.agency.toString() !==
      agency._id.toString()
    ) {
      throw new AppError(
        "You can only assign agents to properties belonging to your agency",
        403,
      );
    }

    // Prevent a suspended Agency from assigning Agents.
    if (
      agency.status !==
      "Active"
    ) {
      throw new AppError(
        "A suspended agency cannot assign an agent",
        403,
      );
    }

    // Find the Agent profile that should receive the Property.
    const agent =
      await Agent.findById(
        agentId,
      ).select(
        "_id agency status",
      );

    // Stop when the Agent does not exist.
    if (!agent) {
      throw new AppError(
        "Agent not found",
        404,
      );
    }

    // Ensure the selected Agent belongs to the same Agency as the Property.
    if (
      !agent.agency ||
      agent.agency.toString() !==
        agency._id.toString()
    ) {
      throw new AppError(
        "You can only assign an agent belonging to your agency",
        403,
      );
    }

    // Prevent Properties from being assigned to inactive Agents.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Cannot assign a property to an inactive agent",
        400,
      );
    }

    // Assign the Property to the selected Agent.
    property.agent =
      agent._id;

    // Mark the Property as fully assigned but waiting for Agent response.
    property.assignmentStatus =
      "Agent Assigned";

    // Record the Agency User who performed the assignment.
    property.assignedBy =
      authenticatedUser._id;

    // Record when the assignment occurred.
    property.assignedAt =
      new Date();

    // Clear any previous Agent response because this is a new assignment cycle.
    property.assignmentRespondedBy =
      null;

    property.assignmentRespondedAt =
      null;

    property.assignmentResponseNote =
      null;

    // Save the updated Property.
    await property.save();

    // Return the updated Property.
    return property;
  };

// Assign or reassign the operational Property Manager for a Property.
// This is additive to the Agency and Agent listing-assignment workflows.
const assignPropertyToManager =
  async (
    propertyId,
    propertyManagerId,
    authenticatedUser,
  ) => {
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    if (
      ![
        "Admin",
        "Super Admin",
      ].includes(
        authenticatedUser.role,
      )
    ) {
      throw new AppError(
        "Only Admin and Super Admin can assign a property manager",
        403,
      );
    }

    const property =
      await Property.findById(
        propertyId,
      );

    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    const propertyManager =
      await User.findOne({
        _id:
          propertyManagerId,
        role:
          "Property Manager",
        isActive:
          true,
      }).select("_id");

    if (!propertyManager) {
      throw new AppError(
        "Active Property Manager not found",
        404,
      );
    }

    property.propertyManager =
      propertyManager._id;

    // Reuse the Property model's established assignment audit fields.
    // They represent the latest assignment action and do not alter lifecycle status.
    property.assignedBy =
      authenticatedUser._id;

    property.assignedAt =
      new Date();

    await property.save();

    return property;
  };

// Fetch Properties currently waiting for a response from the authenticated Agent.
const getAgentProperties =
  async (
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agent users can access their incoming Property assignments.
    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can access agent property assignments",
        403,
      );
    }

    // Find the Agent profile linked to the authenticated User account.
    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    // Stop when the authenticated User has no Agent profile.
    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Only Active Agents can receive and respond to assignments.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active agents can access property assignments",
        403,
      );
    }

    const properties =
      await Property.find({
        agent:
          agent._id,
        assignmentStatus:
          "Agent Assigned",
        origin: {
          $ne: "agent",
        },
      })
        // Populate the Owner who originally submitted the Property.
        .populate({
          path: "owner",
          select:
            "fullName email",
        })
        // Populate the Agency responsible for the Property.
        .populate({
          path: "agency",
          select:
            "name status",
        })
        // Populate the User who performed the latest assignment.
        .populate({
          path: "assignedBy",
          select:
            "fullName email role",
        })
        // Keep newest assignments first.
        .sort({
          assignedAt: -1,
          createdAt: -1,
        });

    // Return the Agent's pending assignment queue.
    return properties;
  };

// Fetch Properties that the authenticated Agent has accepted for active management.
const getAgentListings =
  async (
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agent users can access their accepted Listings.
    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can access agent listings",
        403,
      );
    }

    // Find the Agent profile linked to the authenticated User account.
    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    // Stop when the authenticated User has no Agent profile.
    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Only Active Agents can manage their accepted Listings.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active agents can access agent listings",
        403,
      );
    }

    // Fetch Properties currently managed by this Agent.
    const properties =
      await Property.find({
        agent:
          agent._id,
        $or: [
          // Properties created directly by this Agent.
          {
            origin:
              "agent",
          },

          // Properties assigned by an Agency and accepted by this Agent.
          {
            assignmentStatus:
              "Agent Accepted",
          },
        ],
      })
        // Populate the Owner attached to the Property.
        .populate({
          path: "owner",
          select:
            "fullName email",
        })

        // Populate the Agency responsible for the Property.
        .populate({
          path: "agency",
          select:
            "name status",
        })

        // Keep the newest accepted Listings first.
        .sort({
          assignmentRespondedAt:
            -1,
          updatedAt:
            -1,
        });

    // Build analytics only from Properties that this Agent is authorized to manage.
    const propertyIds =
      properties.map(
        (property) =>
          property._id,
      );

    // Initialise every Property with zero analytics.
    const byProperty = {};

    propertyIds.forEach(
      (propertyId) => {
        byProperty[
          String(
            propertyId,
          )
        ] = {
          views: 0,
          saves: 0,
          offers: 0,
        };
      },
    );

    // Return an empty analytics payload when the Agent has no Listings.
    if (
      propertyIds.length ===
      0
    ) {
      return {
        properties,
        analytics: {
          totalViews: 0,
          totalSaves: 0,
          totalOffers: 0,
          byProperty,
        },
      };
    }

    /*
     * Aggregate the three real marketplace metrics in parallel:
     *
     * PropertyView = detail-page views
     * Favorite     = Buyer saves
     * Offer        = Buyer offers
     */
    const [
      viewTotals,
      saveTotals,
      offerTotals,
    ] = await Promise.all([
      // Count real PropertyView events.
      PropertyView.aggregate([
        {
          $match: {
            property: {
              $in:
                propertyIds,
            },
          },
        },
        {
          $group: {
            _id:
              "$property",
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      // Count real Buyer Favorites/Saves.
      Favorite.aggregate([
        {
          $match: {
            property: {
              $in:
                propertyIds,
            },
          },
        },
        {
          $group: {
            _id:
              "$property",
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      // Count real marketplace Offers, excluding drafts.
      Offer.aggregate([
        {
          $match: {
            property: {
              $in:
                propertyIds,
            },
            status: {
              $ne:
                "Draft",
            },
          },
        },
        {
          $group: {
            _id:
              "$property",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    // Attach real view totals to each Property.
    viewTotals.forEach(
      (item) => {
        const key =
          String(
            item._id,
          );

        if (
          byProperty[
            key
          ]
        ) {
          byProperty[
            key
          ].views =
            item.count;
        }
      },
    );

    // Attach real save totals to each Property.
    saveTotals.forEach(
      (item) => {
        const key =
          String(
            item._id,
          );

        if (
          byProperty[
            key
          ]
        ) {
          byProperty[
            key
          ].saves =
            item.count;
        }
      },
    );

    // Attach real Offer totals to each Property.
    offerTotals.forEach(
      (item) => {
        const key =
          String(
            item._id,
          );

        if (
          byProperty[
            key
          ]
        ) {
          byProperty[
            key
          ].offers =
            item.count;
        }
      },
    );

    // Return the same Properties plus their real analytics.
    return {
      properties,
      analytics: {
        totalViews:
          viewTotals.reduce(
            (
              total,
              item,
            ) =>
              total +
              item.count,
            0,
          ),

        totalSaves:
          saveTotals.reduce(
            (
              total,
              item,
            ) =>
              total +
              item.count,
            0,
          ),

        totalOffers:
          offerTotals.reduce(
            (
              total,
              item,
            ) =>
              total +
              item.count,
            0,
          ),

        byProperty,
      },
    };
  };



// Accept a Property assignment for the authenticated Agent.
const acceptPropertyAssignment =
  async (
    propertyId,
    authenticatedUser,
  ) => {
    // Ensure the request contains a valid authenticated user.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agent users can accept Property assignments.
    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can accept property assignments",
        403,
      );
    }

    // Find the Agent profile linked to the authenticated User account.
    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    // Stop when the authenticated User has no Agent profile.
    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Only Active Agents can accept assignments.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active agents can accept property assignments",
        403,
      );
    }

    // Find only the assignment currently waiting for this Agent's response.
    const property =
      await Property.findOne({
        _id:
          propertyId,
        agent:
          agent._id,
        assignmentStatus:
          "Agent Assigned",
      });

    // Stop when the Property is not currently assigned to this Agent.
    if (!property) {
      throw new AppError(
        "Property assignment not found or no longer awaiting a response",
        404,
      );
    }

    // Mark the assignment as accepted.
    property.assignmentStatus =
      "Agent Accepted";

    // Record which User accepted the assignment.
    property.assignmentRespondedBy =
      authenticatedUser._id;

    // Record the exact response time.
    property.assignmentRespondedAt =
      new Date();

    // Acceptance does not require a response note.
    property.assignmentResponseNote =
      null;

    // Save the accepted assignment.
    await property.save();

    // Return the updated Property.
    return property;
  };

// Decline a Property assignment for the authenticated Agent.
const declinePropertyAssignment =
  async (
    propertyId,
    reason,
    authenticatedUser,
  ) => {
    // Ensure the request contains a valid authenticated user.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agent users can decline Property assignments.
    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can decline property assignments",
        403,
      );
    }

    // Find the Agent profile linked to the authenticated User account.
    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    // Stop when the authenticated User has no Agent profile.
    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Only Active Agents can decline assignments.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active agents can decline property assignments",
        403,
      );
    }

    // Normalize the decline reason before storing it.
    const responseNote =
      typeof reason ===
      "string"
        ? reason.trim()
        : "";

    // Require the Agent to provide a meaningful decline reason.
    if (!responseNote) {
      throw new AppError(
        "A reason is required when declining a property assignment",
        400,
      );
    }

    // Find only the assignment currently waiting for this Agent's response.
    const property =
      await Property.findOne({
        _id:
          propertyId,
        agent:
          agent._id,
        assignmentStatus:
          "Agent Assigned",
      });

    // Stop when the Property is not currently assigned to this Agent.
    if (!property) {
      throw new AppError(
        "Property assignment not found or no longer awaiting a response",
        404,
      );
    }

    // Mark the assignment as declined.
    property.assignmentStatus =
      "Agent Declined";

    // Record which User declined the assignment.
    property.assignmentRespondedBy =
      authenticatedUser._id;

    // Record the exact response time.
    property.assignmentRespondedAt =
      new Date();

    // Store the Agent's decline reason for the Agency workflow and audit trail.
    property.assignmentResponseNote =
      responseNote;

    // Remove the Agent relationship so the Agency can assign the Property again.
    property.agent = null;

    // Save the declined assignment.
    await property.save();

    // Return the updated Property.
    return property;
  };

// Fetch all Properties assigned to the authenticated Agency.
const getAgencyProperties =
  async (
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only an Agency user can access its private Agency property queue.
    if (
      authenticatedUser.role !==
      "Agency"
    ) {
      throw new AppError(
        "Only Agencies can access agency properties",
        403,
      );
    }

    // Find the Agency profile connected to the authenticated User account.
    const agency =
      await Agency.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id name status",
      );

    // Stop if the authenticated Agency has no profile.
    if (!agency) {
      throw new AppError(
        "Agency profile not found for the authenticated user",
        404,
      );
    }

    // Return only Properties assigned to this Agency.
    const properties =
      await Property.find({
        agency:
          agency._id,
      })
        // Populate the Owner so the Assignment Center can show who submitted it.
        .populate({
          path: "owner",
          select:
            "fullName email",
        })
        // Populate the assigned Agent so the Assignment Center can show the current assignee.
        .populate({
          path: "agent",
          select:
            "fullName email status level department",
        })
        // Keep the newest assignments at the top.
        .sort({
          updatedAt:
            -1,
        });

    // Return the Agency Property collection.
    return properties;
  };

  // Update an existing Property from the Admin/Super Admin management workflow.
const updateAdministrativeProperty =
  async (
    propertyId,
    propertyData,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Admin and Super Admin users can use the
    // administrative Property CRUD update workflow.
    if (
      ![
        "Admin",
        "Super Admin",
      ].includes(
        authenticatedUser.role,
      )
    ) {
      throw new AppError(
        "Only Admin and Super Admin can update properties through Property Management",
        403,
      );
    }

    // Retrieve the Property being edited.
    const property =
      await Property.findById(
        propertyId,
      );

    // Stop when the Property does not exist.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    /*
     * Administrative users may edit listing content,
     * but they must not be able to overwrite ownership,
     * assignment, creator, approval, or audit information.
     */
    const protectedFields = [
      "_id",

      "createdBy",
      "createdByRole",
      "origin",

      "owner",
      "agency",
      "agent",
      "propertyManager",

      "assignedBy",
      "assignedAt",

      "assignmentStatus",
      "assignmentRespondedBy",
      "assignmentRespondedAt",
      "assignmentResponseNote",

      "verificationLevel",

      "inspectionStatus",
      "inspectionCompletedAt",
      "inspectedBy",

      "status",
      "availabilityStatus",

      "createdAt",
      "updatedAt",
    ];

    // Clone the request body before removing protected fields.
    const editableData = {
      ...(propertyData || {}),
    };

    // Remove protected fields even when they are sent manually.
    protectedFields.forEach(
      (field) => {
        delete editableData[
          field
        ];
      },
    );

    // Apply only the remaining editable Property fields.
    Object.keys(
      editableData,
    ).forEach(
      (field) => {
        property[field] =
          editableData[field];
      },
    );

    /*
     * Keep normalized marketplace search fields synchronized
     * whenever an editable category or location field changes.
     */
    if (
      editableData.propertyType !==
      undefined
    ) {
      property.propertyTypeNormalized =
        property.propertyType
          ?.trim()
          .toLowerCase();
    }

    if (
      editableData.state !==
      undefined
    ) {
      property.stateNormalized =
        property.state
          ?.trim()
          .toLowerCase();
    }

    if (
      editableData.city !==
      undefined
    ) {
      property.cityNormalized =
        property.city
          ?.trim()
          .toLowerCase();
    }

    /*
     * IMPORTANT:
     *
     * An administrative content edit does NOT automatically
     * move the Property into Pending Review or Published.
     *
     * The current lifecycle status remains authoritative.
     * Therefore:
     *
     * Pending Review stays Pending Review.
     * Approved stays Approved.
     * Published stays Published.
     * Draft stays Draft.
     */
    await property.save();

    // Return the updated Property record.
    return property;
  };

  // Delete a Property through the Admin/Super Admin management workflow.
const deleteAdministrativeProperty =
  async (
    propertyId,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Admin and Super Admin users can delete Properties.
    if (
      ![
        "Admin",
        "Super Admin",
      ].includes(
        authenticatedUser.role,
      )
    ) {
      throw new AppError(
        "Only Admin and Super Admin can delete properties",
        403,
      );
    }

    // Retrieve the Property before attempting deletion.
    const property =
      await Property.findById(
        propertyId,
      );

    // Stop when the Property does not exist.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    /*
     * A Property connected to a Deal contains
     * actual transaction history and must never be
     * hard-deleted.
     */
    const existingDeal =
      await Deal.findOne({
        property:
          property._id,
      }).select("_id");

    if (existingDeal) {
      throw new AppError(
        "This Property cannot be deleted because it has transaction history. Archive the Property instead.",
        409,
      );
    }

    /*
     * Clean up dependent marketplace records before
     * removing the Property itself.
     *
     * This prevents orphaned Favorites, Views,
     * Offers, Inquiries, Bookings, and Approval records.
     */
    await Promise.all([
      Approval.deleteMany({
        property:
          property._id,
      }),

      PropertyView.deleteMany({
        property:
          property._id,
      }),

      Favorite.deleteMany({
        property:
          property._id,
      }),

      Offer.deleteMany({
        property:
          property._id,
      }),

      Inquiry.deleteMany({
        property:
          property._id,
      }),

      Booking.deleteMany({
        property:
          property._id,
      }),
    ]);

    // Permanently remove the Property itself.
    await Property.deleteOne({
      _id:
        property._id,
    });

    // Return a small deletion result instead of a removed Mongoose document.
    return {
      propertyId:
        property._id,
      title:
        property.title,
      deleted:
        true,
    };
  };


  // Update a Property that belongs to the authenticated Agent.
const updateAgentProperty =
  async (
    propertyId,
    propertyData,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agent users can update Agent listings.
    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can update agent properties",
        403,
      );
    }

    // Find the Agent profile linked to the authenticated User.
    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    // Stop when the authenticated User has no Agent profile.
    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Only Active Agents can edit their listings.
    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active agents can update properties",
        403,
      );
    }

    // Find only a Property that belongs to this Agent.
    const property =
      await Property.findOne({
        _id:
          propertyId,
        agent:
          agent._id,

        $or: [
          // Agent-created listing.
          {
            origin:
              "agent",
          },

          // Owner listing assigned and accepted by this Agent.
          {
            assignmentStatus:
              "Agent Accepted",
          },
        ],
      });

    // Prevent the Agent from editing another Agent's Property.
    if (!property) {
      throw new AppError(
        "Property not found or you do not have permission to edit this property",
        404,
      );
    }

    /*
     * A completed transaction should not be reopened
     * through the normal listing-edit workflow.
     */
    const lockedStatuses = [
      "Sold",
      "Rented",
      "Leased",
      "Archived",
    ];

    if (
      lockedStatuses.includes(
        property.status,
      )
    ) {
      throw new AppError(
        "Completed or archived properties cannot be edited",
        409,
      );
    }

    /*
     * The Agent may update listing content,
     * but never ownership, assignment, audit,
     * verification, or lifecycle-control fields.
     */
    const protectedFields = [
      "_id",
      "createdBy",
      "createdByRole",
      "origin",
      "owner",
      "agency",
      "agent",

      "assignedBy",
      "assignedAt",

      "assignmentStatus",
      "assignmentRespondedBy",
      "assignmentRespondedAt",
      "assignmentResponseNote",

      "verificationLevel",

      "inspectionStatus",
      "inspectionCompletedAt",
      "inspectedBy",

      "status",
      "availabilityStatus",

      "createdAt",
      "updatedAt",
    ];

    // Remove protected fields even if they are sent by the frontend.
    protectedFields.forEach(
      (field) => {
        delete propertyData[
          field
        ];
      },
    );

    /*
     * Apply only fields supplied by the frontend.
     */
    Object.keys(
      propertyData,
    ).forEach(
      (field) => {
        property[field] =
          propertyData[field];
      },
    );

    /*
     * Keep normalized search fields synchronized
     * when the editable location/category fields change.
     */
    if (
      propertyData.propertyType !==
      undefined
    ) {
      property.propertyTypeNormalized =
        property.propertyType
          ?.trim()
          .toLowerCase();
    }

    if (
      propertyData.state !==
      undefined
    ) {
      property.stateNormalized =
        property.state
          ?.trim()
          .toLowerCase();
    }

    if (
      propertyData.city !==
      undefined
    ) {
      property.cityNormalized =
        property.city
          ?.trim()
          .toLowerCase();
    }

    /*
     * An Agent edit means the listing must go
     * through review again before it becomes live.
     */
    property.status =
      "Draft";

    /*
     * A Draft listing is not currently live
     * on the public marketplace.
     */
    property.availabilityStatus =
      "Available";

    // Save the updated listing.
    await property.save();

    // Return the updated Property document.
    return property;
  };

// Update an existing Property from the authenticated Agency workflow.
const updateAgencyProperty =
  async (
    propertyId,
    propertyData,
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agency users can edit Properties from the Agency dashboard.
    if (
      authenticatedUser.role !==
      "Agency"
    ) {
      throw new AppError(
        "Only an Agency can update an agency property",
        403,
      );
    }

    // Find the Agency profile linked to the authenticated User.
    const agency =
      await Agency.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id status",
      );

    // Stop when the authenticated User has no Agency profile.
    if (!agency) {
      throw new AppError(
        "Agency profile not found for the authenticated user",
        404,
      );
    }

    // Prevent inactive Agencies from modifying their property portfolio.
    if (
      agency.status !==
      "Active"
    ) {
      throw new AppError(
        "A suspended agency cannot update properties",
        403,
      );
    }

    // Find the Property that the Agency wants to update.
    const property =
      await Property.findById(
        propertyId,
      );

    // Stop when the Property does not exist.
    if (!property) {
      throw new AppError(
        "Property not found",
        404,
      );
    }

    // Ensure the Property belongs to the authenticated Agency.
    if (
      !property.agency ||
      property.agency.toString() !==
        agency._id.toString()
    ) {
      throw new AppError(
        "You can only update properties belonging to your agency",
        403,
      );
    }

    /*
     * Feature protection:
     *
     * A Property can only be newly featured when it is
     * already Published and currently Available.
     *
     * Setting Standard is allowed from any lifecycle state
     * so an old Premium/Exclusive promotion can always be removed.
     */
    if (
      propertyData.featuredLevel !==
        undefined &&
      propertyData.featuredLevel !==
        "Standard"
    ) {
      if (
        property.status !==
        "Published"
      ) {
        throw new AppError(
          "Only published properties can be featured",
          409,
        );
      }

      if (
        property.availabilityStatus !==
        "Available"
      ) {
        throw new AppError(
          "Only available properties can be featured",
          409,
        );
      }
    }

    // Prevent the frontend from changing protected ownership/workflow fields.
    const protectedFields = [
      "createdBy",
      "createdByRole",
      "origin",
      "owner",
      "agency",
      "agent",
      "assignedBy",
      "assignedAt",
      "assignmentStatus",
      "assignmentRespondedBy",
      "assignmentRespondedAt",
      "assignmentResponseNote",
      "verificationLevel",
      "inspectionStatus",
      "inspectionCompletedAt",
      "inspectedBy",
      "status",
      "availabilityStatus",
    ];

    // Remove protected fields even if somebody sends them in the request.
    protectedFields.forEach(
      (field) => {
        delete propertyData[
          field
        ];
      },
    );

    // Update only fields that are actually present in the validated payload.
    Object.keys(
      propertyData,
    ).forEach((field) => {
      property[field] =
        propertyData[field];
    });

    // Keep normalized search fields synchronized with edited values.
    if (
      propertyData.propertyType !==
      undefined
    ) {
      property.propertyTypeNormalized =
        property.propertyType
          ?.trim()
          .toLowerCase();
    }

    if (
      propertyData.state !==
      undefined
    ) {
      property.stateNormalized =
        property.state
          ?.trim()
          .toLowerCase();
    }

    if (
      propertyData.city !==
      undefined
    ) {
      property.cityNormalized =
        property.city
          ?.trim()
          .toLowerCase();
    }

    // Save the updated Property back to MongoDB.
    await property.save();

    // Return the updated Property document.
    return property;
  };

// Archive a Property from the authenticated Agency workflow.
const archiveAgencyProperty = async (
  propertyId,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Agency users can archive Agency properties.
  if (
    authenticatedUser.role !==
    "Agency"
  ) {
    throw new AppError(
      "Only an Agency can archive an agency property",
      403,
    );
  }

  // Find the Agency profile linked to the authenticated User.
  const agency =
    await Agency.findOne({
      user:
        authenticatedUser._id,
    }).select(
      "_id status",
    );

  // Stop when the authenticated User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agencies from archiving Properties.
  if (
    agency.status !==
    "Active"
  ) {
    throw new AppError(
      "A suspended agency cannot archive properties",
      403,
    );
  }

  // Find the Property that the Agency wants to archive.
  const property =
    await Property.findById(
      propertyId,
    );

  // Stop when the Property does not exist.
  if (!property) {
    throw new AppError(
      "Property not found",
      404,
    );
  }

  // Ensure the Property belongs to the authenticated Agency.
  if (
    !property.agency ||
    property.agency.toString() !==
      agency._id.toString()
  ) {
    throw new AppError(
      "You can only archive properties belonging to your agency",
      403,
    );
  }

  // Do not archive an already archived Property.
  if (
    property.status ===
    "Archived"
  ) {
    throw new AppError(
      "This property is already archived",
      409,
    );
  }

  // Archive the Property through a dedicated lifecycle action.
  property.status =
    "Archived";

  // Archived Properties are no longer available to the market.
  property.availabilityStatus =
    "Unavailable";

  // Remove any active promotional level from the archived Property.
  property.featuredLevel =
    "Standard";

  // Save the lifecycle change.
  await property.save();

  // Return the updated Property.
  return property;
};

// Restore an archived Property through the authenticated Agency workflow.
const unarchiveAgencyProperty = async (
  propertyId,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Agency users can unarchive Agency properties.
  if (
    authenticatedUser.role !==
    "Agency"
  ) {
    throw new AppError(
      "Only an Agency can unarchive an agency property",
      403,
    );
  }

  // Find the Agency profile linked to the authenticated User.
  const agency =
    await Agency.findOne({
      user:
        authenticatedUser._id,
    }).select(
      "_id status",
    );

  // Stop when the authenticated User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agencies from restoring Properties.
  if (
    agency.status !==
    "Active"
  ) {
    throw new AppError(
      "A suspended agency cannot unarchive properties",
      403,
    );
  }

  // Find the Property that the Agency wants to restore.
  const property =
    await Property.findById(
      propertyId,
    );

  // Stop when the Property does not exist.
  if (!property) {
    throw new AppError(
      "Property not found",
      404,
    );
  }

  // Ensure the Property belongs to the authenticated Agency.
  if (
    !property.agency ||
    property.agency.toString() !==
      agency._id.toString()
  ) {
    throw new AppError(
      "You can only unarchive properties belonging to your agency",
      403,
    );
  }

  // Only Archived Properties can be unarchived.
  if (
    property.status !==
    "Archived"
  ) {
    throw new AppError(
      "Only archived properties can be unarchived",
      409,
    );
  }

  // Restore the Property to the Agency's active marketplace state.
  property.status =
    "Published";

  // Make the restored Property available again.
  property.availabilityStatus =
    "Available";

  // Unarchiving does not automatically re-feature the Property.
  property.featuredLevel =
    "Standard";

  // Save the lifecycle change.
  await property.save();

  // Return the restored Property.
  return property;
};

// Retrieve real PropertyView totals for every Property belonging to the authenticated Agency.
const getAgencyPropertyAnalytics =
  async (
    authenticatedUser,
  ) => {
    // Ensure a valid authenticated user was provided.
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    // Only Agency users can access Agency listing analytics.
    if (
      authenticatedUser.role !==
      "Agency"
    ) {
      throw new AppError(
        "Only Agencies can access agency listing analytics",
        403,
      );
    }

    // Find the Agency profile connected to the authenticated User account.
    const agency =
      await Agency.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id status",
      );

    // Stop if the authenticated User has no Agency profile.
    if (!agency) {
      throw new AppError(
        "Agency profile not found for the authenticated user",
        404,
      );
    }

    // Prevent inactive Agencies from accessing private listing analytics.
    if (
      agency.status !==
      "Active"
    ) {
      throw new AppError(
        "A suspended agency cannot access listing analytics",
        403,
      );
    }

    // Get the Property IDs currently belonging to this Agency.
    const agencyProperties =
      await Property.find({
        agency:
          agency._id,
      }).select("_id");

    // Build a simple list of MongoDB Property IDs for aggregation.
    const propertyIds =
      agencyProperties.map(
        (property) =>
          property._id,
      );

    // Return empty analytics when the Agency has no Properties.
    if (
      propertyIds.length ===
      0
    ) {
      return {
        totalViews: 0,
        byProperty: {},
      };
    }

    // Aggregate real PropertyView records by Property.
    const viewTotals =
      await PropertyView.aggregate(
        [
          {
            $match: {
              property: {
                $in:
                  propertyIds,
              },
            },
          },
          {
            $group: {
              _id:
                "$property",
              views: {
                $sum: 1,
              },
            },
          },
        ],
      );

    // Convert aggregation results into a fast Property-ID lookup object.
    const byProperty = {};

    viewTotals.forEach(
      (item) => {
        byProperty[
          String(item._id)
        ] = {
          views:
            item.views,

          // Enquiries are filled in by the frontend from the existing Inquiry API.
          enquiries: 0,
        };
      },
    );

    // Return the real view totals for the Agency's Properties.
    return {
      totalViews:
        viewTotals.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.views,
          0,
        ),

      byProperty,
    };
  };

  // Fetch Properties created by the authenticated Admin or Super Admin.
// This mirrors the Agent's authenticated My Listings pattern while keeping
// the existing all-properties management endpoint unchanged.
// Fetch Properties created by the authenticated Admin or Super Admin.
// This mirrors the Agent's authenticated My Listings pattern while
// keeping the existing all-properties management endpoint unchanged.
const getAdministrativeProperties = async (
  authenticatedUser,
) => {
  // Ensure authenticated User information is available.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Admin and Super Admin users can access
  // their personal Property Review collection.
  if (
    ![
      "Admin",
      "Super Admin",
    ].includes(
      authenticatedUser.role,
    )
  ) {
    throw new AppError(
      "Only Admin and Super Admin users can access administrative property review",
      403,
    );
  }

  /*
   * Scope by both creator User and creator role so
   * Admin and Super Admin records remain isolated.
   */
  const properties =
    await Property.find({
      createdBy:
        authenticatedUser._id,

      createdByRole:
        authenticatedUser.role,
    })
      .populate({
        path: "owner",
        select:
          "fullName email",
      })
      .populate({
        path: "agency",
        select:
          "name status",
      })
      .populate({
        path: "agent",
        select:
          "user agency status",
        populate: {
          path: "user",
          select:
            "fullName email",
        },
      })
      .sort({
        createdAt: -1,
      });

  /*
   * Build analytics from exactly the Properties
   * returned for this Admin/Super Admin.
   */
  const propertyIds =
    properties.map(
      (property) =>
        property._id,
    );

  /*
   * Initialise every Property with zero analytics.
   * This guarantees that the frontend always has a
   * predictable analytics object for every card.
   */
  const byProperty = {};

  propertyIds.forEach(
    (propertyId) => {
      byProperty[
        String(
          propertyId,
        )
      ] = {
        views: 0,
        saves: 0,
        offers: 0,
      };
    },
  );

  /*
   * Return an empty analytics payload when this
   * Admin/Super Admin has not created any Properties.
   */
  if (
    propertyIds.length ===
    0
  ) {
    return {
      properties,
      analytics: {
        totalViews: 0,
        totalSaves: 0,
        totalOffers: 0,
        byProperty,
      },
    };
  }

  /*
   * Aggregate the same three real marketplace
   * metrics used by the Agent Properties page:
   *
   * PropertyView = detail-page views
   * Favorite     = Buyer saves
   * Offer        = Buyer offers
   */
  const [
    viewTotals,
    saveTotals,
    offerTotals,
  ] = await Promise.all([
    // Count real PropertyView events.
    PropertyView.aggregate([
      {
        $match: {
          property: {
            $in:
              propertyIds,
          },
        },
      },
      {
        $group: {
          _id:
            "$property",
          count: {
            $sum: 1,
          },
        },
      },
    ]),

    // Count real Buyer Favorites/Saves.
    Favorite.aggregate([
      {
        $match: {
          property: {
            $in:
              propertyIds,
          },
        },
      },
      {
        $group: {
          _id:
            "$property",
          count: {
            $sum: 1,
          },
        },
      },
    ]),

    // Count real marketplace Offers, excluding drafts.
    Offer.aggregate([
      {
        $match: {
          property: {
            $in:
              propertyIds,
          },
          status: {
            $ne:
              "Draft",
          },
        },
      },
      {
        $group: {
          _id:
            "$property",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  // Attach real view totals to each Property.
  viewTotals.forEach(
    (item) => {
      const key =
        String(
          item._id,
        );

      if (
        byProperty[
          key
        ]
      ) {
        byProperty[
          key
        ].views =
          item.count;
      }
    },
  );

  // Attach real save totals to each Property.
  saveTotals.forEach(
    (item) => {
      const key =
        String(
          item._id,
        );

      if (
        byProperty[
          key
        ]
      ) {
        byProperty[
          key
        ].saves =
          item.count;
      }
    },
  );

  // Attach real Offer totals to each Property.
  offerTotals.forEach(
    (item) => {
      const key =
        String(
          item._id,
        );

      if (
        byProperty[
          key
        ]
      ) {
        byProperty[
          key
        ].offers =
          item.count;
      }
    },
  );

  // Return the Properties plus their real analytics,
  // using the same contract as Agent listings.
  return {
    properties,

    analytics: {
      totalViews:
        viewTotals.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.count,
          0,
        ),

      totalSaves:
        saveTotals.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.count,
          0,
        ),

      totalOffers:
        offerTotals.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.count,
          0,
        ),

      byProperty,
    },
  };
};

// Export all Property service functions used by the controllers.
module.exports = {
  createProperty,
  getProperties,
  getOwnerProperties,
    // Administrative Property CRUD.
  updateAdministrativeProperty,
  deleteAdministrativeProperty,
  withdrawOwnerProperty,
  addOwnerPropertyDocuments,
  getAgencyProperties,

  archiveAgencyProperty,
  unarchiveAgencyProperty,
  getPropertyById,
  recordPropertyView,
  assignPropertyToAgency,
  assignPropertyToAgent,
  declinePropertyForAgency,
  assignPropertyToManager,

  // Expose the Agent assignment queue to the controller.
  getAgentProperties,

  // Expose the Agent accepted listings to the controller.
  getAgentListings,

  // Expose the Agent assignment acceptance workflow to the controller.
  acceptPropertyAssignment,

  // Expose the Agent assignment decline workflow to the controller.
  declinePropertyAssignment,

  // Agent listing editing.
  updateAgentProperty,

  // Expose real Agency listing analytics to the controller.
  getAgencyPropertyAnalytics,

  // Expose the Agency Property update workflow to the controller.
  updateAgencyProperty,
    getAdministrativeProperties,
};