// Import the Booking model so we can create and retrieve viewing requests.
const Booking = require("../models/booking.model");

// Import the Property model so we can verify that the requested property exists.
const Property = require("../models/property.model");

// Import AppError so predictable business-rule failures use the project's
// existing centralized error handling.
const AppError = require("../utils/AppError");

const Agency = require("../models/agency.model");


const Agent = require("../models/agent.model");

// Create a new viewing request for the authenticated Buyer.
const createBooking = async (buyerId, bookingData) => {
  // Check that the requested Property exists in the database.
  const property = await Property.findById(bookingData.propertyId);

  // Stop the request when the Property cannot be found.
  if (!property) {
    throw new AppError("Property not found.", 404);
  }

  // Viewing requests are only allowed for live, available properties.
if (property.status !== "Published") {
  throw new AppError(
    "Viewing requests can only be made for published properties.",
    400,
  );
}

if (property.availabilityStatus !== "Available") {
  throw new AppError(
    "This property is not currently available for viewing.",
    400,
  );
}

  // Create the viewing request using the authenticated Buyer ID.
  const booking = await Booking.create({
    buyer: buyerId,
    property: bookingData.propertyId,
    viewingDate: bookingData.viewingDate,
    viewingTime: bookingData.viewingTime,
    message: bookingData.message || "",
  });

  // Return the newly created request with its Property details included.
  return Booking.findById(booking._id).populate("property");
};

// Get all viewing requests belonging to the authenticated Buyer.
const getBookingsByBuyer = async (buyerId) => {
  return Booking.find({ buyer: buyerId })
    .populate({
      path: "property",
      populate: {
        path: "agent",
        select: "user status",
        populate: {
          path: "user",
          select: "_id fullName avatar role",
        },
      },
    })
    .sort({ createdAt: -1 });
};

// Cancel a viewing request belonging to the authenticated Buyer.
const cancelBooking = async (buyerId, bookingId) => {
  // Find the booking and make sure it belongs to the authenticated Buyer.
  const booking = await Booking.findOne({
    _id: bookingId,
    buyer: buyerId,
  }).populate("property");

  // Stop the request when the booking does not exist or belongs to another Buyer.
  if (!booking) {
    throw new AppError("Viewing request not found.", 404);
  }

  // A completed or already cancelled viewing cannot be cancelled again.
  if (booking.status === "Completed" || booking.status === "Cancelled") {
    throw new AppError(
      `Viewing request cannot be cancelled because it is already ${booking.status.toLowerCase()}.`,
      400,
    );
  }

  // Mark the Buyer's viewing request as cancelled.
  booking.status = "Cancelled";

  // Save the updated booking.
  await booking.save();

  // Return the updated booking with Property details included.
  return booking;
};

// Reschedule a viewing request belonging to the authenticated Buyer.
const rescheduleBooking = async (buyerId, bookingId, rescheduleData) => {
  // Find the booking and make sure it belongs to the authenticated Buyer.
  const booking = await Booking.findOne({
    _id: bookingId,
    buyer: buyerId,
  }).populate("property");

  // Stop the request when the booking does not exist or belongs to another Buyer.
  if (!booking) {
    throw new AppError("Viewing request not found.", 404);
  }

  // A completed or cancelled viewing cannot be rescheduled.
  if (booking.status === "Completed" || booking.status === "Cancelled") {
    throw new AppError(
      `Viewing request cannot be rescheduled because it is already ${booking.status.toLowerCase()}.`,
      400,
    );
  }

  // Update the requested viewing date.
  booking.viewingDate = rescheduleData.viewingDate;

  // Update the requested viewing time.
  booking.viewingTime = rescheduleData.viewingTime;

  // Persist the Buyer's reschedule note using the Booking's existing message field.
if (
  typeof rescheduleData.message === "string"
) {
  booking.message =
    rescheduleData.message.trim();
}

  // Mark the request as rescheduled.
  booking.status = "Rescheduled";

  // Save the updated viewing request.
  await booking.save();

  // Return the updated booking with Property details included.
  return booking;
};

// Get all viewing requests for properties managed by the authenticated Agency.
const getBookingsByAgency = async (agencyUserId) => {
  // Resolve the authenticated Agency User to its separate Agency document.
  const agency = await Agency.findOne({
    user: agencyUserId,
  }).select("_id");

  // Stop with a clear error when the authenticated User has no Agency record.
  if (!agency) {
    throw new AppError("Agency profile not found.", 404);
  }

  // Find all properties currently assigned to this Agency document.
  const agencyProperties = await Property.find({
    agency: agency._id,
  }).select("_id");

  // Extract the Property IDs used to locate the Agency's viewing requests.
  const propertyIds = agencyProperties.map(
    (property) => property._id,
  );

  // Return an empty list when the Agency has no assigned properties.
  if (propertyIds.length === 0) {
    return [];
  }

  // Find every booking attached to one of the Agency's properties.
  return Booking.find({
    property: { $in: propertyIds },
  })
    // Include Buyer details for the Agency schedule.
    .populate("buyer", "fullName email phone")
    // Include the Property details needed by the dashboard.
    .populate(
      "property",
      "title address area city state propertyType coverImage images agent agency",
    )
    // Include the Agent assigned to each Property.
    .populate({
      path: "property",
      populate: {
        path: "agent",
        select: "fullName email phone",
      },
    })
    // Show the nearest viewing dates first.
    .sort({
      viewingDate: 1,
      createdAt: -1,
    });
};

// Get all viewing requests for properties assigned to the authenticated Agent.
const getBookingsByAgent = async (agentUserId) => {
  // Resolve the authenticated Agent User to the Agent profile.
  const agent = await Agent.findOne({
    user: agentUserId,
  }).select("_id fullName email phone status");

  // Stop when the User has no Agent profile.
  if (!agent) {
    throw new AppError("Agent profile not found.", 404);
  }

  // Prevent inactive Agents from accessing viewing requests.
  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive.",
      403,
    );
  }

  // Find properties currently assigned to this Agent.
  const assignedProperties = await Property.find({
    agent: agent._id,
  }).select("_id");

  const propertyIds = assignedProperties.map(
    (property) => property._id,
  );

  // The Agent has no assigned properties, so there can be no bookings.
  if (propertyIds.length === 0) {
    return [];
  }

  // Return Buyer viewing requests for this Agent's properties.
  return Booking.find({
    property: { $in: propertyIds },
  })
    .populate(
      "buyer",
      "fullName email phone",
    )
    .populate(
      "property",
      "title address area city state propertyType transactionType coverImage images price currency status availabilityStatus agent agency",
    )
    .sort({
      viewingDate: 1,
      createdAt: -1,
    });
};


// Confirm a viewing request assigned to the authenticated Agent.
const confirmBookingByAgent = async (agentUserId, bookingId) => {
  // Resolve the authenticated User to the Agent profile.
  const agent = await Agent.findOne({
    user: agentUserId,
  }).select("_id status");

  if (!agent) {
    throw new AppError("Agent profile not found.", 404);
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive.",
      403,
    );
  }

  // Find the booking and include its property.
  const booking = await Booking.findById(
    bookingId,
  ).populate("property");

  if (!booking) {
    throw new AppError(
      "Viewing request not found.",
      404,
    );
  }

  // Make sure this booking belongs to a property
  // actually assigned to the authenticated Agent.
  if (
    !booking.property ||
    String(booking.property.agent) !==
      String(agent._id)
  ) {
    throw new AppError(
      "You are not assigned to this viewing request.",
      403,
    );
  }

  // Only pending or rescheduled requests can be confirmed.
  if (
    booking.status !== "Pending" &&
    booking.status !== "Rescheduled"
  ) {
    throw new AppError(
      `Viewing request cannot be confirmed because it is already ${booking.status.toLowerCase()}.`,
      400,
    );
  }

  booking.status = "Confirmed";

  await booking.save();

  return Booking.findById(booking._id)
    .populate(
      "buyer",
      "fullName email phone",
    )
    .populate("property");
};

// Reject a viewing request assigned to the authenticated Agent.
const rejectBookingByAgent = async (
  agentUserId,
  bookingId,
) => {
  const agent = await Agent.findOne({
    user: agentUserId,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found.",
      404,
    );
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive.",
      403,
    );
  }

  const booking = await Booking.findById(
    bookingId,
  ).populate("property");

  if (!booking) {
    throw new AppError(
      "Viewing request not found.",
      404,
    );
  }

  if (
    !booking.property ||
    String(booking.property.agent) !==
      String(agent._id)
  ) {
    throw new AppError(
      "You are not assigned to this viewing request.",
      403,
    );
  }

  if (
    booking.status !== "Pending" &&
    booking.status !== "Rescheduled"
  ) {
    throw new AppError(
      `Viewing request cannot be rejected because it is already ${booking.status.toLowerCase()}.`,
      400,
    );
  }

  booking.status = "Rejected";

  await booking.save();

  return Booking.findById(
    booking._id,
  )
    .populate(
      "buyer",
      "fullName email phone",
    )
    .populate("property");
};


// Mark a confirmed viewing as completed.
const completeBookingByAgent = async (
  agentUserId,
  bookingId,
) => {
  const agent = await Agent.findOne({
    user: agentUserId,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found.",
      404,
    );
  }

  if (agent.status !== "Active") {
    throw new AppError(
      "The agent account is inactive.",
      403,
    );
  }

  const booking = await Booking.findById(
    bookingId,
  ).populate("property");

  if (!booking) {
    throw new AppError(
      "Viewing request not found.",
      404,
    );
  }

  if (
    !booking.property ||
    String(booking.property.agent) !==
      String(agent._id)
  ) {
    throw new AppError(
      "You are not assigned to this viewing request.",
      403,
    );
  }

  if (booking.status !== "Confirmed") {
    throw new AppError(
      "Only a confirmed viewing can be marked as completed.",
      400,
    );
  }

  booking.status = "Completed";

  await booking.save();

  return Booking.findById(
    booking._id,
  )
    .populate(
      "buyer",
      "fullName email phone",
    )
    .populate("property");
};

// Export the Booking service functions for the controller to use.
module.exports = {
  createBooking,
  getBookingsByBuyer,
  getBookingsByAgency,
  getBookingsByAgent,
  confirmBookingByAgent,
  rejectBookingByAgent,
  completeBookingByAgent,
  cancelBooking,
  rescheduleBooking,
};