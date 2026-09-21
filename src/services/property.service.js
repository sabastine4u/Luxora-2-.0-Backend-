// Import the Property model used to persist Property records in MongoDB.
const Property = require("../models/property.model");

// Import the PropertyView model used to record marketplace view events.
const PropertyView = require("../models/property-view.model");

// Import the dedicated Agency model used to validate Agency assignments.
const Agency = require("../models/agency.model");

// Import the dedicated Agent model used for Agent-specific relationships.
const Agent = require("../models/agent.model");

// Import User so Admins can assign only real Property Manager accounts.
const User = require("../models/user.model");

// Import the application error class used for controlled business errors.
const AppError = require("../utils/AppError");

// Import the Property search service used to build marketplace queries.
const searchService = require("./search.service");

// Define the roles that are allowed to create Property records.
const PROPERTY_CREATOR_ROLES = ["Owner", "Agent", "Admin", "Super Admin"];

// Create a new Property using the authenticated user's identity and role.
const createProperty = async (propertyData, authenticatedUser) => {
  // Ensure a valid authenticated user was provided by the protected route.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required to create a property",
      401,
    );
  }

  // Check whether the authenticated role is allowed to create a Property.
  if (!PROPERTY_CREATOR_ROLES.includes(authenticatedUser.role)) {
    throw new AppError("You do not have permission to create a property", 403);
  }

  // Build the Property payload using validated data and server-controlled fields.
  const propertyPayload = {
    ...propertyData,

    // Record the authenticated User as the true creator of the Property.
    createdBy: authenticatedUser._id,

    // Record the authenticated user's role instead of trusting the request body.
    createdByRole: authenticatedUser.role,

    // Store a normalized lowercase version of the Property type for exact-match searches.
    propertyTypeNormalized: propertyData.propertyType?.trim().toLowerCase(),

    // Store a normalized lowercase version of the Property state for exact-match searches.
    stateNormalized: propertyData.state?.trim().toLowerCase(),

    // Store a normalized lowercase version of the Property city for exact-match searches.
    cityNormalized: propertyData.city?.trim().toLowerCase(),
  };

  // Set the Property origin from the authenticated creator role.
  if (authenticatedUser.role === "Owner") {
    // Owner-created Properties originate from the Owner submission workflow.
    propertyPayload.origin = "owner";

    // The authenticated Owner is automatically the property's Owner relationship.
    propertyPayload.owner = authenticatedUser._id;
  } else if (authenticatedUser.role === "Agent") {
    // Agent-created Properties originate from the Agent marketplace workflow.
    propertyPayload.origin = "agent";
  } else if (authenticatedUser.role === "Admin") {
    // Admin-created Properties originate from the Admin workflow.
    propertyPayload.origin = "admin";
  } else {
    // Super Admin-created Properties originate from Luxora's internal workflow.
    propertyPayload.origin = "luxora";
  }

  // Handle Agent-specific relationships when an Agent creates the Property.
  if (authenticatedUser.role === "Agent") {
    // Find the Agent profile belonging to the authenticated User.
    const agentProfile = await Agent.findOne({
      user: authenticatedUser._id,
    }).select("_id agency");

    // Reject the request if the authenticated User does not have an Agent profile.
    if (!agentProfile) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    // Force the Property Agent relationship to the authenticated Agent profile.
    propertyPayload.agent = agentProfile._id;

    // Automatically associate the Agent's Agency with the Property when available.
    if (agentProfile.agency) {
      propertyPayload.agency = agentProfile.agency;
    }
  }

  // Owner submissions begin in the agency-assignment stage.
  if (authenticatedUser.role === "Owner") {
    propertyPayload.assignmentStatus = "Pending Agency Assignment";
  }

  // Agent-created listings are already owned by the authenticated Agent.
  // They do not enter the incoming Assignment queue.
  // The Agent's own listing will remain in My Listings and move through
  // the normal Draft -> Pending Review -> Approved -> Published lifecycle.
  if (authenticatedUser.role === "Agent") {
    propertyPayload.assignmentStatus = null;
  }
  // Create the Property record in MongoDB.
  const property = await Property.create(propertyPayload);

  // Return the newly created Property to the controller.
  return property;
};

// Fetch publicly visible Properties using the dedicated search service.
const getProperties = async (query = {}) => {
  // Delegate filtering, sorting, and pagination to the dedicated search service.
  const result = await searchService.searchProperties(query);

  // Return the complete search result, including pagination metadata.
  return result;
};

// Fetch all Properties belonging to the authenticated Owner.
const getOwnerProperties = async (authenticatedUser) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Owners can access their private Property Requests.
  if (authenticatedUser.role !== "Owner") {
    throw new AppError("Only Owners can access their property requests", 403);
  }

  // Find only Properties whose Owner relationship belongs to the authenticated User.
  const properties = await Property.find({
    owner: authenticatedUser._id,
  })
    // Populate the Agent profile assigned to the Property.
    .populate({
      path: "agent",
      select: "user agency status",
      populate: {
        // Populate the User account connected to the Agent profile.
        path: "user",
        select: "fullName email",
      },
    })
    // Populate the Agency assigned to the Property.
    .populate({
      path: "agency",
      select: "name status",
    })
    // Keep Owner requests ordered with the newest submissions first.
    .sort({ createdAt: -1 });

  // Return the Owner's complete Property collection.
  return properties;
};

// Fetch one publicly visible Property by its MongoDB ID.
const getPropertyById = async (propertyId) => {
  // Find the Property only when it has been published to the marketplace.
  const property = await Property.findOne({
    _id: propertyId,
    status: "Published",
  })
    .populate({
      path: "agent",
      select: "user agency",
      populate: {
        // Populate the User account linked to the Agent profile.
        path: "user",
        select: "fullName email",
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
      select: "fullName email",
    });

  // Return null when the Property does not exist or is not publicly published.
  return property;
};

// Record a public Property detail-page view.
const recordPropertyView = async (propertyId, visitorId) => {
  // Require the anonymous visitor identifier from the frontend.
  if (!visitorId) {
    throw new AppError("Visitor ID is required to record a property view", 400);
  }

  // Ensure only publicly published Properties generate marketplace views.
  const property = await Property.findOne({
    _id: propertyId,
    status: "Published",
  }).select("_id");

  // Stop when the Property does not exist or is not publicly published.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Check whether this visitor viewed the same Property within the last 30 minutes.
  const recentView = await PropertyView.findOne({
    property: propertyId,
    visitorId,
    viewedAt: {
      $gte: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  // Avoid counting repeated refreshes as new views within the cooldown window.
  if (recentView) {
    return {
      recorded: false,
      view: recentView,
    };
  }

  // Store the new real Property view event.
  const view = await PropertyView.create({
    property: propertyId,
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
const assignPropertyToAgency = async (
  propertyId,
  agencyId,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Admin and Super Admin can assign Properties to Agencies.
  if (!["Admin", "Super Admin"].includes(authenticatedUser.role)) {
    throw new AppError(
      "Only Admin and Super Admin can assign a property to an agency",
      403,
    );
  }

  // Find the Property that is being assigned.
  const property = await Property.findById(propertyId);

  // Stop when the Property does not exist.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Only Owner-originated Properties enter the
  // Admin/Super Admin -> Agency assignment workflow.
  if (property.origin !== "owner") {
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
  ].includes(property.assignmentStatus)
) {
  throw new AppError(
    "This Property cannot be assigned to an Agency in its current workflow state",
    409,
  );
}

  // Owner properties must still be in Draft before Agency assignment.
  if (property.status !== "Draft") {
    throw new AppError(
      "Only Draft Owner properties can be assigned to an agency",
      409,
    );
  }
  // Find the Agency that will receive the Property.
  const agency = await Agency.findById(agencyId);

  // Prevent reassigning the Property to the same Agency that declined it.
if (
  property.assignmentStatus === "Agency Declined" &&
  property.agency &&
  property.agency.toString() === agencyId.toString()
) {
  throw new AppError(
    "You cannot reassign the property to the same agency that declined it",
    409,
  );
}

  // Stop when the Agency does not exist.
  if (!agency) {
    throw new AppError("Agency not found", 404);
  }

  // Prevent Properties from being assigned to a suspended Agency.
  if (agency.status !== "Active") {
    throw new AppError("Cannot assign a property to a suspended agency", 400);
  }

  // Assign the Property to the selected Agency.
  property.agency = agency._id;

  // Clear any previous Agent assignment because the Agency will choose the Agent.
  property.agent = null;

  // Move the Property to the Agency-assignment stage.
  property.assignmentStatus = "Agency Assigned";

  // Record the User who performed the assignment.
  property.assignedBy = authenticatedUser._id;

  // Record when the assignment occurred.
  property.assignedAt = new Date();

  // Clear any previous Agent response because this starts a new assignment cycle.
  property.assignmentRespondedBy = null;
  property.assignmentRespondedAt = null;
  property.assignmentResponseNote = null;

  // Save the updated Property.
  await property.save();

  // Return the updated Property.
  return property;
};

// Allow the authenticated Agency to decline an Owner-submitted Property assignment.
const declinePropertyForAgency = async (
  propertyId,
  reason,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Agency users can decline Agency assignments.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError(
      "Only an Agency can decline a property assignment",
      403,
    );
  }

  // Normalize the Agency's rejection reason.
  const responseNote =
    typeof reason === "string" ? reason.trim() : "";

  // A reason is mandatory for an Agency rejection.
  if (!responseNote) {
    throw new AppError(
      "A reason is required when declining a property assignment",
      400,
    );
  }

  // Find the Agency linked to the authenticated User.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Only Active Agencies can respond to assignments.
  if (agency.status !== "Active") {
    throw new AppError(
      "A suspended agency cannot decline property assignments",
      403,
    );
  }

  // Only the currently assigned Agency can decline this assignment.
  const property = await Property.findOne({
    _id: propertyId,
    agency: agency._id,
    origin: "owner",
    status: "Draft",
    assignmentStatus: "Agency Assigned",
  });

  if (!property) {
    throw new AppError(
      "Property assignment not found or no longer awaiting an Agency response",
      404,
    );
  }

  // Record the Agency rejection.
  property.assignmentStatus = "Agency Declined";

  // Record the Agency User who rejected the assignment.
  property.assignmentRespondedBy = authenticatedUser._id;

  // Record when the Agency responded.
  property.assignmentRespondedAt = new Date();

  // Store the rejection reason.
  property.assignmentResponseNote = responseNote;

  // There should not be an Agent attached at this stage.
  property.agent = null;

  await property.save();

  return property;
};

// Assign or reassign a Property to an Agent.
// Only the Agency responsible for the Property can perform this operation.
const assignPropertyToAgent = async (
  propertyId,
  agentId,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agency users can assign or reassign Agents.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError(
      "Only an Agency can assign or reassign a property to an agent",
      403,
    );
  }

  // Find the Property that is being assigned.
  const property = await Property.findById(propertyId);

  // Stop when the Property does not exist.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Ensure the Property already has an Agency assigned.
  if (!property.agency) {
    throw new AppError("This property has not been assigned to an agency", 400);
  }

  // Agency assignment is only valid for the Owner workflow.
  if (property.origin !== "owner") {
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
    property.assignmentStatus !== "Agency Assigned" &&
    property.assignmentStatus !== "Agent Declined"
  ) {
    throw new AppError("This Property is not ready for Agent assignment", 409);
  }

  // The property itself should still be in Draft.
  if (property.status !== "Draft") {
    throw new AppError(
      "Only Draft Owner properties can be assigned to an agent",
      409,
    );
  }

  // Find the Agency profile linked to the authenticated Agency User.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  // Stop when the authenticated Agency User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      403,
    );
  }

  // Ensure the authenticated Agency owns the Property assignment.
  if (property.agency.toString() !== agency._id.toString()) {
    throw new AppError(
      "You can only assign agents to properties belonging to your agency",
      403,
    );
  }

  // Prevent a suspended Agency from assigning Agents.
  if (agency.status !== "Active") {
    throw new AppError("A suspended agency cannot assign an agent", 403);
  }

  // Find the Agent profile that should receive the Property.
  const agent = await Agent.findById(agentId).select("_id agency status");

  // Stop when the Agent does not exist.
  if (!agent) {
    throw new AppError("Agent not found", 404);
  }

  // Ensure the selected Agent belongs to the same Agency as the Property.
  if (!agent.agency || agent.agency.toString() !== agency._id.toString()) {
    throw new AppError(
      "You can only assign an agent belonging to your agency",
      403,
    );
  }

  // Prevent Properties from being assigned to inactive Agents.
  if (agent.status !== "Active") {
    throw new AppError("Cannot assign a property to an inactive agent", 400);
  }

  // Assign the Property to the selected Agent.
  property.agent = agent._id;

  // Mark the Property as fully assigned but waiting for Agent response.
  property.assignmentStatus = "Agent Assigned";

  // Record the Agency User who performed the assignment.
  property.assignedBy = authenticatedUser._id;

  // Record when the assignment occurred.
  property.assignedAt = new Date();

  // Clear any previous Agent response because this is a new assignment cycle.
  property.assignmentRespondedBy = null;
  property.assignmentRespondedAt = null;
  property.assignmentResponseNote = null;

  // Save the updated Property.
  await property.save();

  // Return the updated Property.
  return property;
};

// Assign or reassign the operational Property Manager for a Property.
// This is additive to the Agency and Agent listing-assignment workflows.
const assignPropertyToManager = async (
  propertyId,
  propertyManagerId,
  authenticatedUser,
) => {
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  if (!["Admin", "Super Admin"].includes(authenticatedUser.role)) {
    throw new AppError(
      "Only Admin and Super Admin can assign a property manager",
      403,
    );
  }

  const property = await Property.findById(propertyId);

  if (!property) {
    throw new AppError("Property not found", 404);
  }

  const propertyManager = await User.findOne({
    _id: propertyManagerId,
    role: "Property Manager",
    isActive: true,
  }).select("_id");

  if (!propertyManager) {
    throw new AppError("Active Property Manager not found", 404);
  }

  property.propertyManager = propertyManager._id;

  // Reuse the Property model's established assignment audit fields. They
  // represent the latest assignment action and do not alter lifecycle status.
  property.assignedBy = authenticatedUser._id;
  property.assignedAt = new Date();

  await property.save();

  return property;
};

// Fetch Properties currently waiting for a response from the authenticated Agent.
const getAgentProperties = async (authenticatedUser) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agent users can access their incoming Property assignments.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError(
      "Only Agents can access agent property assignments",
      403,
    );
  }

  // Find the Agent profile linked to the authenticated User account.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id agency status");

  // Stop when the authenticated User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      403,
    );
  }

  // Only Active Agents can receive and respond to assignments.
  if (agent.status !== "Active") {
    throw new AppError(
      "Only active agents can access property assignments",
      403,
    );
  }

  const properties = await Property.find({
    agent: agent._id,
    assignmentStatus: "Agent Assigned",
    origin: { $ne: "agent" },
  })
    // Populate the Owner who originally submitted the Property.
    .populate({
      path: "owner",
      select: "fullName email",
    })
    // Populate the Agency responsible for the Property.
    .populate({
      path: "agency",
      select: "name status",
    })
    // Populate the User who performed the latest assignment.
    .populate({
      path: "assignedBy",
      select: "fullName email role",
    })
    // Keep newest assignments first.
    .sort({ assignedAt: -1, createdAt: -1 });

  // Return the Agent's pending assignment queue.
  return properties;
};

// Fetch Properties that the authenticated Agent has accepted for active management.
const getAgentListings = async (authenticatedUser) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agent users can access their accepted Listings.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError("Only Agents can access agent listings", 403);
  }

  // Find the Agent profile linked to the authenticated User account.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id agency status");

  // Stop when the authenticated User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      403,
    );
  }

  // Only Active Agents can manage their accepted Listings.
  if (agent.status !== "Active") {
    throw new AppError("Only active agents can access agent listings", 403);
  }

  const properties = await Property.find({
    agent: agent._id,
    $or: [
      // Properties created directly by this Agent.
      {
        origin: "agent",
      },

      // Properties assigned by an Agency and accepted by this Agent.
      {
        assignmentStatus: "Agent Accepted",
      },
    ],
  })
    // Populate the Owner attached to the Property.
    .populate({
      path: "owner",
      select: "fullName email",
    })
    // Populate the Agency responsible for the Property.
    .populate({
      path: "agency",
      select: "name status",
    })
    // Keep the newest accepted Listings first.
    .sort({ assignmentRespondedAt: -1, updatedAt: -1 });

  // Return the Agent's accepted Listing portfolio.
  return properties;
};

// Accept a Property assignment for the authenticated Agent.
const acceptPropertyAssignment = async (propertyId, authenticatedUser) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agent users can accept Property assignments.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError("Only Agents can accept property assignments", 403);
  }

  // Find the Agent profile linked to the authenticated User account.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id agency status");

  // Stop when the authenticated User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      403,
    );
  }

  // Only Active Agents can accept assignments.
  if (agent.status !== "Active") {
    throw new AppError(
      "Only active agents can accept property assignments",
      403,
    );
  }

  // Find only the assignment currently waiting for this Agent's response.
  const property = await Property.findOne({
    _id: propertyId,
    agent: agent._id,
    assignmentStatus: "Agent Assigned",
  });

  // Stop when the Property is not currently assigned to this Agent.
  if (!property) {
    throw new AppError(
      "Property assignment not found or no longer awaiting a response",
      404,
    );
  }

  // Mark the assignment as accepted.
  property.assignmentStatus = "Agent Accepted";

  // Record which User accepted the assignment.
  property.assignmentRespondedBy = authenticatedUser._id;

  // Record the exact response time.
  property.assignmentRespondedAt = new Date();

  // Acceptance does not require a response note.
  property.assignmentResponseNote = null;

  // Save the accepted assignment.
  await property.save();

  // Return the updated Property.
  return property;
};

// Decline a Property assignment for the authenticated Agent.
const declinePropertyAssignment = async (
  propertyId,
  reason,
  authenticatedUser,
) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agent users can decline Property assignments.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError("Only Agents can decline property assignments", 403);
  }

  // Find the Agent profile linked to the authenticated User account.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id agency status");

  // Stop when the authenticated User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      403,
    );
  }

  // Only Active Agents can decline assignments.
  if (agent.status !== "Active") {
    throw new AppError(
      "Only active agents can decline property assignments",
      403,
    );
  }

  // Normalize the decline reason before storing it.
  const responseNote = typeof reason === "string" ? reason.trim() : "";

  // Require the Agent to provide a meaningful decline reason.
  if (!responseNote) {
    throw new AppError(
      "A reason is required when declining a property assignment",
      400,
    );
  }

  // Find only the assignment currently waiting for this Agent's response.
  const property = await Property.findOne({
    _id: propertyId,
    agent: agent._id,
    assignmentStatus: "Agent Assigned",
  });

  // Stop when the Property is not currently assigned to this Agent.
  if (!property) {
    throw new AppError(
      "Property assignment not found or no longer awaiting a response",
      404,
    );
  }

  // Mark the assignment as declined.
  property.assignmentStatus = "Agent Declined";

  // Record which User declined the assignment.
  property.assignmentRespondedBy = authenticatedUser._id;

  // Record the exact response time.
  property.assignmentRespondedAt = new Date();

  // Store the Agent's decline reason for the Agency workflow and audit trail.
  property.assignmentResponseNote = responseNote;

  // Remove the Agent relationship so the Agency can assign the Property again.
  property.agent = null;

  // Save the declined assignment.
  await property.save();

  // Return the updated Property.
  return property;
};

// Fetch all Properties assigned to the currently authenticated Agency.
const getAgencyProperties = async (authenticatedUser) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only an Agency user can access its private Agency property queue.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError("Only Agencies can access agency properties", 403);
  }

  // Find the Agency profile connected to the authenticated User account.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select("_id name status");

  // Stop if the authenticated Agency has no profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Return only Properties assigned to this Agency.
  const properties = await Property.find({
    agency: agency._id,
  })
    // Populate the Owner so the Assignment Center can show who submitted it.
    .populate({
      path: "owner",
      select: "fullName email",
    })
    // Populate the assigned Agent so the Assignment Center can show the current assignee.
    .populate({
      path: "agent",
      select: "fullName email status level department",
    })
    // Keep the newest assignments at the top.
    .sort({ updatedAt: -1 });

  // Return the Agency Property collection.
  return properties;
};

// Update an existing Property from the authenticated Agency workflow.
const updateAgencyProperty = async (
  propertyId,
  propertyData,
  authenticatedUser,
) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agency users can edit Properties from the Agency dashboard.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError("Only an Agency can update an agency property", 403);
  }

  // Find the Agency profile linked to the authenticated User.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  // Stop when the authenticated User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agencies from modifying their property portfolio.
  if (agency.status !== "Active") {
    throw new AppError("A suspended agency cannot update properties", 403);
  }

  // Find the Property that the Agency wants to update.
  const property = await Property.findById(propertyId);

  // Stop when the Property does not exist.
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  // Ensure the Property belongs to the authenticated Agency.
  if (
    !property.agency ||
    property.agency.toString() !== agency._id.toString()
  ) {
    throw new AppError(
      "You can only update properties belonging to your agency",
      403,
    );
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
  ];

  // Remove protected fields even if somebody sends them in the request.
  protectedFields.forEach((field) => {
    delete propertyData[field];
  });

  // Update only fields that are actually present in the validated payload.
  Object.keys(propertyData).forEach((field) => {
    property[field] = propertyData[field];
  });

  // Keep normalized search fields synchronized with edited values.
  if (propertyData.propertyType !== undefined) {
    property.propertyTypeNormalized = property.propertyType
      ?.trim()
      .toLowerCase();
  }

  if (propertyData.state !== undefined) {
    property.stateNormalized = property.state?.trim().toLowerCase();
  }

  if (propertyData.city !== undefined) {
    property.cityNormalized = property.city?.trim().toLowerCase();
  }

  // Save the updated Property back to MongoDB.
  await property.save();

  // Return the updated Property document.
  return property;
};

// Retrieve real PropertyView totals for every Property belonging to the authenticated Agency.
const getAgencyPropertyAnalytics = async (authenticatedUser) => {
  // Ensure the request contains a valid authenticated user.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError("Authenticated user information is required", 401);
  }

  // Only Agency users can access Agency listing analytics.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError(
      "Only Agencies can access agency listing analytics",
      403,
    );
  }

  // Find the Agency profile connected to the authenticated User account.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  // Stop if the authenticated User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agencies from accessing private listing analytics.
  if (agency.status !== "Active") {
    throw new AppError(
      "A suspended agency cannot access listing analytics",
      403,
    );
  }

  // Get the Property IDs currently belonging to this Agency.
  const agencyProperties = await Property.find({
    agency: agency._id,
  }).select("_id");

  // Build a simple list of MongoDB Property IDs for aggregation.
  const propertyIds = agencyProperties.map((property) => property._id);

  // Return empty analytics when the Agency has no Properties.
  if (propertyIds.length === 0) {
    return {
      totalViews: 0,
      byProperty: {},
    };
  }

  // Aggregate real PropertyView records by Property.
  const viewTotals = await PropertyView.aggregate([
    {
      $match: {
        property: {
          $in: propertyIds,
        },
      },
    },
    {
      $group: {
        _id: "$property",
        views: {
          $sum: 1,
        },
      },
    },
  ]);

  // Convert aggregation results into a fast Property-ID lookup object.
  const byProperty = {};

  viewTotals.forEach((item) => {
    byProperty[String(item._id)] = {
      views: item.views,

      // Enquiries are filled in by the frontend from the existing Inquiry API.
      enquiries: 0,
    };
  });

  // Return the real view totals for the Agency's Properties.
  return {
    totalViews: viewTotals.reduce((total, item) => total + item.views, 0),
    byProperty,
  };
};

// Export all Property service functions used by the controllers.
module.exports = {
  createProperty,
  getProperties,
  getOwnerProperties,
  getAgencyProperties,
  getPropertyById,
  recordPropertyView,
  assignPropertyToAgency,
  assignPropertyToAgent,
  declinePropertyForAgency,
  assignPropertyToManager,

  // Expose the Agent assignment queue to the controller.
  getAgentProperties,
  getAgentListings,
  // Expose the Agent assignment acceptance workflow to the controller.
  acceptPropertyAssignment,

  // Expose the Agent assignment decline workflow to the controller.
  declinePropertyAssignment,

  // Expose real Agency listing analytics to the controller.
  getAgencyPropertyAnalytics,

  // Expose the Agency Property update workflow to the controller.
  updateAgencyProperty,
};
