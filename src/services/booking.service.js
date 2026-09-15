// Import the Booking model so we can create and retrieve viewing requests.
const Booking = require("../models/booking.model");

// Import the Property model so we can verify that the requested property exists.
const Property = require("../models/property.model");

// Import AppError so predictable business-rule failures use the project's
// existing centralized error handling.
const AppError = require("../utils/AppError");

const Agency = require("../models/agency.model");

// Create a new viewing request for the authenticated Buyer.
const createBooking = async (buyerId, bookingData) => {
  // Check that the requested Property exists in the database.
  const property = await Property.findById(bookingData.propertyId);

  // Stop the request when the Property cannot be found.
  if (!property) {
    throw new AppError("Property not found.", 404);
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
  // Find only bookings created by this Buyer.
  return Booking.find({ buyer: buyerId })
    // Include the related Property so the dashboard can display its details.
    .populate("property")
    // Show the newest viewing requests first.
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

// Export the Booking service functions for the controller to use.
module.exports = {
  createBooking,
  getBookingsByBuyer,
  getBookingsByAgency,
  cancelBooking,
  rescheduleBooking,
};