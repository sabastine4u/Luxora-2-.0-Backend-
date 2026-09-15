const mongoose = require("mongoose");

// Import the Inquiry model used to persist real property inquiries.
const Inquiry = require("../models/inquiry.model");

// Import Property so Agency, Agent, and Owner relationships come from the listing.
const Property = require("../models/property.model");

// Import Agency so Agency dashboard access is tied to the authenticated Agency account.
const Agency = require("../models/agency.model");

// Import Agent so Agent Lead and appointment access can be tied to the authenticated Agent profile.
const Agent = require("../models/agent.model");

// Import the shared application error helper.
const AppError = require("../utils/AppError");

// Create a new property inquiry from the public Contact Agent workflow.
const createInquiry = async (
  inquiryData = {},
  authenticatedUser = null,
) => {
  // Read only the fields that the seeker is allowed to submit.
  const {
    propertyId,
    fullName,
    email,
    phone,
    message,
    source = "Contact Agent",
    preferredDate = null,
    preferredTime = null,
  } = inquiryData;

  // Require a valid Property ID before attempting the database lookup.
  if (
    !propertyId ||
    !mongoose.isValidObjectId(propertyId)
  ) {
    throw new AppError(
      "A valid property ID is required",
      400,
    );
  }

  // Require the core contact information used by the inquiry workflow.
  if (
    !fullName?.trim() ||
    !email?.trim() ||
    !phone?.trim() ||
    !message?.trim()
  ) {
    throw new AppError(
      "Full name, email, phone, and message are required",
      400,
    );
  }

  // Only allow supported inquiry sources.
  if (
    ![
      "Contact Agent",
      "Schedule Viewing",
      "Website",
    ].includes(source)
  ) {
    throw new AppError(
      "Invalid inquiry source",
      400,
    );
  }

  // Only published Properties should receive public inquiries.
  const property = await Property.findOne({
    _id: propertyId,
    status: "Published",
  }).select(
    "_id title agency agent owner status",
  );

  // Stop when the Property is missing or is not currently public.
  if (!property) {
    throw new AppError(
      "Property not found or is not currently published",
      404,
    );
  }

  // Build trusted relationship data from the Property itself.
  const inquiryPayload = {
    property: property._id,
    agency: property.agency || null,
    agent: property.agent || null,
    owner: property.owner || null,

    // Attach the authenticated seeker when one exists.
    inquirer:
      authenticatedUser?._id || null,

    // Store normalized contact details.
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    message: message.trim(),

    // Store the validated inquiry workflow values.
    source,
    preferredDate:
      preferredDate || null,
    preferredTime:
      preferredTime?.trim() || null,
  };

  // Persist the inquiry as a real MongoDB record.
  const inquiry = await Inquiry.create(
    inquiryPayload,
  );

  // Return the newly created inquiry.
  return inquiry;
};

// Retrieve all inquiries belonging to the authenticated Agency.
const getAgencyInquiries = async (
  authenticatedUser,
) => {
  // Ensure the request contains authenticated-user information.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Keep this service explicitly Agency-only.
  if (authenticatedUser.role !== "Agency") {
    throw new AppError(
      "Only an Agency can access agency inquiries",
      403,
    );
  }

  // Find the Agency connected to the logged-in User.
  const agency = await Agency.findOne({
    user: authenticatedUser._id,
  }).select(
    "_id name status",
  );

  // Stop when the User has no Agency profile.
  if (!agency) {
    throw new AppError(
      "Agency profile not found for the authenticated user",
      404,
    );
  }

  // Prevent suspended Agencies from accessing the inquiry pipeline.
  if (agency.status !== "Active") {
    throw new AppError(
      "The agency account is suspended",
      403,
    );
  }

  // Retrieve the Agency's real inquiries with their Property and Agent.
  const inquiries = await Inquiry.find({
    agency: agency._id,
  })
    .populate({
      path: "property",
      select:
        "title city state status",
    })
    .populate({
      path: "agent",
      select:
        "fullName email status",
    })
    .sort({
      createdAt: -1,
    });

  // Return the Agency inquiry collection.
  return inquiries;
};

// Retrieve all inquiries assigned to the authenticated Agent.
const getAgentInquiries = async (
  authenticatedUser,
) => {
  // Ensure the request contains authenticated-user information.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Keep this service explicitly Agent-only.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError(
      "Only an Agent can access agent leads",
      403,
    );
  }

  // Find the Agent profile connected to the logged-in User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  // Stop when the User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  // Prevent suspended Agents from accessing their Lead pipeline.
  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is not active",
      403,
    );
  }

  // Retrieve only inquiries assigned to this Agent.
  const inquiries = await Inquiry.find({
    agent: agent._id,
  })
    // Populate the Property that generated the inquiry.
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status images coverImage",
    })
    // Populate the Agency responsible for the Property.
    .populate({
      path: "agency",
      select: "name status",
    })
    // Populate the Owner when the Property has one.
    .populate({
      path: "owner",
      select: "fullName email",
    })
    // Keep newest inquiries at the top of the Agent Lead pipeline.
    .sort({
      createdAt: -1,
    });

  // Return the authenticated Agent's real Lead collection.
  return inquiries;
};

// Build a CRM-style client list from the authenticated Agent's real inquiries.
const getAgentClients = async (
  authenticatedUser,
) => {
  // Require authenticated Agent information.
  if (
    !authenticatedUser?._id ||
    authenticatedUser?.role !== "Agent"
  ) {
    throw new AppError(
      "Only an authenticated Agent can access agent clients",
      403,
    );
  }

  // Find the Agent profile belonging to the authenticated User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agents from accessing client records.
  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is not active",
      403,
    );
  }

  // Retrieve every real inquiry assigned to this Agent.
  const inquiries = await Inquiry.find({
    agent: agent._id,
  })
    .populate({
      path: "property",
      select:
        "_id title propertyType transactionType city state area price currency status",
    })
    .sort({
      createdAt: -1,
    });

  // Use email as the stable contact key because some public inquiries
  // may not have an authenticated User attached to them.
  const clientMap = new Map();

  for (const inquiry of inquiries) {
    // Normalize the email so duplicate casing does not create duplicate clients.
    const clientKey =
      inquiry.email?.trim().toLowerCase();

    // Ignore malformed inquiry records without an email.
    if (!clientKey) {
      continue;
    }

    const existingClient =
      clientMap.get(clientKey);

    // Use the newest inquiry as the current representation of the contact.
    if (!existingClient) {
      clientMap.set(clientKey, {
        id: clientKey,
        name: inquiry.fullName,
        email: inquiry.email,
        phone: inquiry.phone,

        // Count how many real inquiries belong to this contact.
        inquiryCount: 1,

        // Track distinct properties the contact has asked about.
        propertyCount: inquiry.property
          ? 1
          : 0,

        // Keep the newest interaction date.
        lastContactAt:
          inquiry.lastActivityAt ||
          inquiry.updatedAt ||
          inquiry.createdAt,

        // Keep the first known interaction date.
        firstInteractionAt:
          inquiry.createdAt,

        // Keep the current/latest Lead status.
        status:
          inquiry.status || "New",

        // Preserve the latest property context.
        latestProperty:
          inquiry.property || null,

        // Track whether a real authenticated User exists.
        isRegisteredUser:
          Boolean(inquiry.inquirer),

        // Preserve the source of the latest interaction.
        latestSource:
          inquiry.source || null,

        // Track whether this contact still has an active Lead.
        hasActiveInquiry:
          ![
            "Closed",
            "Lost",
          ].includes(
            inquiry.status,
          ),
      });

      continue;
    }

    // Add another inquiry belonging to the same real contact.
    existingClient.inquiryCount += 1;

    // Count a new property only when it has not already appeared for this contact.
    if (inquiry.property?._id) {
      const previousPropertyIds =
        existingClient._propertyIds ||
        new Set();

      previousPropertyIds.add(
        String(
          inquiry.property._id,
        ),
      );

      existingClient._propertyIds =
        previousPropertyIds;

      existingClient.propertyCount =
        previousPropertyIds.size;
    }

    // Keep the oldest interaction date for client tenure calculations.
    if (
      new Date(inquiry.createdAt) <
      new Date(
        existingClient.firstInteractionAt,
      )
    ) {
      existingClient.firstInteractionAt =
        inquiry.createdAt;
    }

    // Keep the latest activity date.
    const inquiryActivity =
      inquiry.lastActivityAt ||
      inquiry.updatedAt ||
      inquiry.createdAt;

    if (
      new Date(inquiryActivity) >
      new Date(
        existingClient.lastContactAt,
      )
    ) {
      existingClient.lastContactAt =
        inquiryActivity;

      // The newest inquiry becomes the current visible Lead context.
      existingClient.name =
        inquiry.fullName;

      existingClient.phone =
        inquiry.phone;

      existingClient.status =
        inquiry.status || "New";

      existingClient.latestProperty =
        inquiry.property || null;

      existingClient.latestSource =
        inquiry.source || null;

      existingClient.isRegisteredUser =
        Boolean(inquiry.inquirer);
    }

    // Keep the client active when at least one inquiry is still open.
    if (
      ![
        "Closed",
        "Lost",
      ].includes(
        inquiry.status,
      )
    ) {
      existingClient.hasActiveInquiry =
        true;
    }
  }

  // Remove the internal Set before returning the API payload.
  const clients = Array.from(
    clientMap.values(),
  ).map((client) => {
    const {
      _propertyIds,
      ...publicClient
    } = client;

    return {
      ...publicClient,

      // Return a CRM-friendly relationship status derived only from real Leads.
      relationshipStatus:
        publicClient.hasActiveInquiry
          ? "Active"
          : "Past",

      // The current backend does not store a client lifetime transaction value.
      totalValue: null,

      // The current backend does not store a client engagement score.
      engagementScore: null,
    };
  });

  // Return newest client relationships first.
  clients.sort(
    (a, b) =>
      new Date(
        b.lastContactAt,
      ).getTime() -
      new Date(
        a.lastContactAt,
      ).getTime(),
  );

  return clients;
};

// Update the status of a Lead owned by the authenticated Agent.
const updateAgentInquiryStatus = async (
  inquiryId,
  status,
  note,
  authenticatedUser,
) => {
  // Require a valid MongoDB Inquiry ID.
  if (
    !inquiryId ||
    !mongoose.isValidObjectId(inquiryId)
  ) {
    throw new AppError(
      "A valid inquiry ID is required",
      400,
    );
  }

  // Require the authenticated Agent.
  if (
    !authenticatedUser?._id ||
    authenticatedUser?.role !== "Agent"
  ) {
    throw new AppError(
      "Only an authenticated Agent can update Lead status",
      403,
    );
  }

  // Only allow the status values defined by the Inquiry model.
  const allowedStatuses = [
    "New",
    "Contacted",
    "Viewing Scheduled",
    "Negotiating",
    "Closed",
    "Lost",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new AppError(
      "Invalid Lead status",
      400,
    );
  }

  // Find the Agent profile connected to the authenticated User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is not active",
      403,
    );
  }

  // Only update a Lead that belongs to this Agent.
  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    agent: agent._id,
  });

  if (!inquiry) {
    throw new AppError(
      "Lead not found or is not assigned to this Agent",
      404,
    );
  }

  const previousStatus = inquiry.status;

  // Store the first contact timestamp when the Lead first becomes Contacted.
  if (
    !inquiry.firstContactedAt &&
    status === "Contacted"
  ) {
    inquiry.firstContactedAt = new Date();
  }

  // Update the current Lead status.
  inquiry.status = status;

  // Store the latest activity timestamp.
  inquiry.lastActivityAt = new Date();

  // Record the status transition in the activity history.
  inquiry.activities.push({
    action:
      status === "Contacted"
        ? "Contacted"
        : "Status Changed",
    description:
      note?.trim() ||
      `Lead status changed from ${previousStatus} to ${status}`,
    performedBy:
      authenticatedUser._id,
  });

  await inquiry.save();

  // Return the updated Lead with its related dashboard data.
  return Inquiry.findById(
    inquiry._id,
  )
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status images coverImage",
    })
    .populate({
      path: "agency",
      select: "name status",
    })
    .populate({
      path: "owner",
      select: "fullName email",
    });
};

// Add a real Agent note to an assigned Lead.
const addAgentInquiryNote = async (
  inquiryId,
  note,
  authenticatedUser,
) => {
  // Require a valid MongoDB Inquiry ID.
  if (
    !inquiryId ||
    !mongoose.isValidObjectId(inquiryId)
  ) {
    throw new AppError(
      "A valid inquiry ID is required",
      400,
    );
  }

  // Require the authenticated Agent.
  if (
    !authenticatedUser?._id ||
    authenticatedUser?.role !== "Agent"
  ) {
    throw new AppError(
      "Only an authenticated Agent can add Lead notes",
      403,
    );
  }

  // Require meaningful note content.
  if (!note?.trim()) {
    throw new AppError(
      "Lead note is required",
      400,
    );
  }

  // Find the Agent profile belonging to the authenticated User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is not active",
      403,
    );
  }

  // Only allow notes on Leads assigned to this Agent.
  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    agent: agent._id,
  });

  if (!inquiry) {
    throw new AppError(
      "Lead not found or is not assigned to this Agent",
      404,
    );
  }

  const now = new Date();

  // Add the note to the Lead.
  inquiry.notes.push({
    text: note.trim(),
    addedBy:
      authenticatedUser._id,
    addedAt: now,
  });

  // Update the latest Lead activity timestamp.
  inquiry.lastActivityAt = now;

  // Record the note action for future activity intelligence.
  inquiry.activities.push({
    action: "Note Added",
    description: note.trim(),
    performedBy:
      authenticatedUser._id,
    createdAt: now,
  });

  await inquiry.save();

  return Inquiry.findById(
    inquiry._id,
  )
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status images coverImage",
    })
    .populate({
      path: "agency",
      select: "name status",
    })
    .populate({
      path: "owner",
      select: "fullName email",
    });
};

// Schedule or reschedule a viewing for an assigned Lead.
const scheduleAgentInquiryViewing = async (
  inquiryId,
  scheduledDate,
  scheduledTime,
  note,
  authenticatedUser,
) => {
  // Require a valid MongoDB Inquiry ID.
  if (
    !inquiryId ||
    !mongoose.isValidObjectId(inquiryId)
  ) {
    throw new AppError(
      "A valid inquiry ID is required",
      400,
    );
  }

  // Require the authenticated Agent.
  if (
    !authenticatedUser?._id ||
    authenticatedUser?.role !== "Agent"
  ) {
    throw new AppError(
      "Only an authenticated Agent can schedule a viewing",
      403,
    );
  }

  // Require both viewing date and viewing time.
  if (
    !scheduledDate ||
    !scheduledTime?.trim()
  ) {
    throw new AppError(
      "Scheduled date and time are required",
      400,
    );
  }

  const parsedDate = new Date(
    scheduledDate,
  );

  // Reject invalid date values.
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(
      "Invalid scheduled viewing date",
      400,
    );
  }

  // Find the Agent profile belonging to the authenticated User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is not active",
      403,
    );
  }

  // Only allow the Agent to schedule viewings for their own Leads.
  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    agent: agent._id,
  });

  if (!inquiry) {
    throw new AppError(
      "Lead not found or is not assigned to this Agent",
      404,
    );
  }

  // Remember whether an appointment already exists.
  const wasAlreadyScheduled =
    Boolean(
      inquiry.scheduledDate ||
      inquiry.scheduledTime,
    );

  // Preserve the current Lead status when rescheduling.
  // Only a Lead that has never reached the viewing stage
  // should automatically move into "Viewing Scheduled".
  const previousLeadStatus =
    inquiry.status;

  const now = new Date();

  // Store the confirmed viewing schedule.
  inquiry.scheduledDate =
    parsedDate;

  inquiry.scheduledTime =
    scheduledTime.trim();

  // Scheduling or rescheduling always activates the appointment.
  inquiry.appointmentStatus =
    "Scheduled";

  // Only move the Lead into "Viewing Scheduled"
  // when it is still in an earlier pipeline stage.
  if (
    !wasAlreadyScheduled &&
    [
      "New",
      "Contacted",
    ].includes(previousLeadStatus)
  ) {
    inquiry.status =
      "Viewing Scheduled";
  } else {
    inquiry.status =
      previousLeadStatus;
  }

  // Record the latest activity timestamp.
  inquiry.lastActivityAt = now;

  // Record the scheduling action.
  inquiry.activities.push({
    action: wasAlreadyScheduled
      ? "Viewing Rescheduled"
      : "Viewing Scheduled",
    description:
      note?.trim() ||
      `${
        wasAlreadyScheduled
          ? "Viewing rescheduled"
          : "Viewing scheduled"
      } for ${parsedDate.toISOString()} at ${scheduledTime.trim()}`,
    performedBy:
      authenticatedUser._id,
    createdAt: now,
  });

  await inquiry.save();

  return Inquiry.findById(
    inquiry._id,
  )
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status images coverImage",
    })
    .populate({
      path: "agency",
      select: "name status",
    })
    .populate({
      path: "owner",
      select: "fullName email",
    });
};

// Retrieve all scheduled viewing appointments for the authenticated Agent.
const getAgentAppointments = async (
  authenticatedUser,
) => {
  // Ensure the request contains authenticated-user information.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Keep this service explicitly Agent-only.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError(
      "Only an Agent can access Agent appointments",
      403,
    );
  }

  // Find the Agent profile connected to the logged-in User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select(
    "_id fullName email status agency",
  );

  // Stop when the User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agents from accessing appointment data.
  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive",
      403,
    );
  }

  // Retrieve inquiries that have an actual scheduled viewing.
  //
  // We intentionally use scheduledDate/scheduledTime instead of only
  // status === "Viewing Scheduled". A Lead may move to Negotiating after
  // the viewing is booked, while the appointment itself still exists.
  const inquiries = await Inquiry.find({
    agent: agent._id,
    scheduledDate: {
      $ne: null,
    },
    scheduledTime: {
      $ne: null,
    },
  })
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status",
    })
    .sort({
      scheduledDate: 1,
      createdAt: -1,
    });

  // Convert the Inquiry records into the appointment shape needed by the UI.
  return inquiries.map(
    (inquiry) => {
      const property =
        inquiry.property || null;

      return {
        // Use the Inquiry ID because the appointment belongs to the Lead.
        id: String(
          inquiry._id,
        ),

        // Keep the source Inquiry ID available for future appointment actions.
        inquiryId: String(
          inquiry._id,
        ),

        // Client information comes directly from the real Inquiry.
        clientName:
          inquiry.fullName,

        clientEmail:
          inquiry.email,

        clientPhone:
          inquiry.phone,

        // Property information comes from the real Property relation.
        propertyId: property
          ? String(property._id)
          : null,

        title:
          property?.title ||
          "Property Viewing",

        propertyType:
          property?.propertyType ||
          null,

        transactionType:
          property?.transactionType ||
          null,

        // Preserve the raw scheduled values for the frontend.
        scheduledDate:
          inquiry.scheduledDate,

        scheduledTime:
          inquiry.scheduledTime,

        // Human-readable values used directly by the existing table.
        date:
          inquiry.scheduledDate
            ? new Date(
                inquiry.scheduledDate,
              ).toLocaleDateString(
                "en-NG",
                {
                  dateStyle:
                    "medium",
                },
              )
            : "Date unavailable",

        time:
          inquiry.scheduledTime ||
          "Time unavailable",

        // Build the location from the real Property fields.
        location:
          [
            property?.area,
            property?.city,
            property?.state,
          ]
            .filter(Boolean)
            .join(", ") ||
          "Location unavailable",

        // Preserve the Lead pipeline status.
        status:
          inquiry.status,

        // Preserve the actual appointment lifecycle status.
        appointmentStatus:
          inquiry.appointmentStatus ||
          "Scheduled",

        // Priority is not currently stored by the backend.
        priority:
          null,

        source:
          inquiry.source,

        message:
          inquiry.message,

        // Return real Agent notes for the appointment modal.
        notes:
          inquiry.notes || [],

        // Return real Lead activity history for the appointment timeline.
        activities:
          inquiry.activities || [],

        createdAt:
          inquiry.createdAt,

        updatedAt:
          inquiry.updatedAt,
      };
    },
  );
};

// Update the appointment status for an appointment owned by the authenticated Agent.
const updateAgentAppointmentStatus = async (
  authenticatedUser,
  inquiryId,
  appointmentStatus,
) => {
  // Ensure authenticated user information is available.
  if (
    !authenticatedUser?._id ||
    !authenticatedUser?.role
  ) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Keep this operation restricted to Agents.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError(
      "Only an Agent can update appointment status",
      403,
    );
  }

  // Require a valid Inquiry ID.
  if (
    !inquiryId ||
    !mongoose.isValidObjectId(inquiryId)
  ) {
    throw new AppError(
      "A valid inquiry ID is required",
      400,
    );
  }

  // Validate the requested appointment status.
  const allowedStatuses = [
    "Scheduled",
    "Completed",
    "Cancelled",
  ];

  if (
    !allowedStatuses.includes(
      appointmentStatus,
    )
  ) {
    throw new AppError(
      "Invalid appointment status",
      400,
    );
  }

  // Find the Agent profile connected to the logged-in User.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  // Prevent inactive Agents from modifying appointments.
  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive",
      403,
    );
  }

  // Only update an Inquiry that belongs to this Agent
  // and already contains a real scheduled viewing.
  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    agent: agent._id,
    scheduledDate: {
      $ne: null,
    },
    scheduledTime: {
      $ne: null,
    },
  });

  if (!inquiry) {
    throw new AppError(
      "Appointment not found",
      404,
    );
  }

  const previousAppointmentStatus =
    inquiry.appointmentStatus ||
    "Scheduled";

  const now = new Date();

  // Update only the appointment state.
  inquiry.appointmentStatus =
    appointmentStatus;

  // Keep the existing activity history available.
  inquiry.activities =
    inquiry.activities || [];

  // Record the appointment action in the activity history.
  inquiry.activities.push({
    action:
      appointmentStatus ===
      "Completed"
        ? "Viewing Completed"
        : appointmentStatus ===
          "Cancelled"
        ? "Viewing Cancelled"
        : "Viewing Scheduled",

    description:
      appointmentStatus ===
      "Completed"
        ? "Agent marked the scheduled viewing as completed."
        : appointmentStatus ===
          "Cancelled"
        ? "Agent cancelled the scheduled viewing."
        : `Appointment status changed from ${previousAppointmentStatus} to Scheduled.`,

    // performedBy is an ObjectId in the Inquiry schema.
    performedBy:
      authenticatedUser._id,

    createdAt: now,
  });

  // Keep the Lead activity timestamp current.
  inquiry.lastActivityAt =
    now;

  await inquiry.save();

  // Return the updated Inquiry with its real related records.
  return Inquiry.findById(
    inquiry._id,
  )
    .populate({
      path: "property",
      select:
        "title propertyType transactionType city state area price currency status images coverImage",
    })
    .populate({
      path: "agency",
      select: "name status",
    })
    .populate({
      path: "owner",
      select: "fullName email",
    });
};

// Export all Inquiry services used by the public, Agency, and Agent workflows.
module.exports = {
  createInquiry,
  getAgencyInquiries,
  getAgentInquiries,
  updateAgentInquiryStatus,
  addAgentInquiryNote,
  scheduleAgentInquiryViewing,
  getAgentClients,
  getAgentAppointments,
  updateAgentAppointmentStatus,
};