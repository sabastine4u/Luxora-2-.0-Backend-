// Import the Booking service so the controller can use the viewing-request logic.
const bookingService = require("../services/booking.service");

// Import the Joi validation schema for creating viewing requests.
const { createBookingSchema } = require("../validators/booking.validator");

// Import AppError for validation failures handled by the application's
// centralized error middleware.
const AppError = require("../utils/AppError");

// Create a new viewing request for the authenticated Buyer.
const createBooking = async (req, res, next) => {
  try {
    // Validate and normalize the incoming request body.
    const { error, value } = createBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Return a validation error when the submitted data is invalid.
    if (error) {
      throw new AppError(
        error.details.map((detail) => detail.message).join(", "),
        400,
      );
    }

    // Create the booking using the authenticated user's ID.
    const booking = await bookingService.createBooking(req.user._id, value);

    // Return the newly created viewing request.
    return res.status(201).json({
      status: "success",
      data: {
        booking,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get all viewing requests belonging to the authenticated Buyer.
const getMyBookings = async (req, res, next) => {
  try {
    // Retrieve only the bookings belonging to the logged-in Buyer.
    const bookings = await bookingService.getBookingsByBuyer(req.user._id);

    // Return the Buyer's viewing requests.
    return res.status(200).json({
      status: "success",
      results: bookings.length,
      data: {
        bookings,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get viewing requests for properties managed by the authenticated Agency.
const getAgencyBookings = async (req, res, next) => {
  try {
    // Retrieve bookings belonging to properties assigned to this Agency.
    const bookings = await bookingService.getBookingsByAgency(
      req.user._id,
    );

    // Return the Agency viewing schedule.
    return res.status(200).json({
      status: "success",
      results: bookings.length,
      data: {
        bookings,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Cancel a viewing request for the authenticated Buyer.
const cancelBooking = async (req, res, next) => {
  try {
    // Cancel only the booking owned by the authenticated Buyer.
    const booking = await bookingService.cancelBooking(
      req.user._id,
      req.params.bookingId,
    );

    // Return the updated viewing request.
    return res.status(200).json({
      status: "success",
      data: {
        booking,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Reschedule a viewing request for the authenticated Buyer.
const rescheduleBooking = async (req, res, next) => {
  try {
    // Reschedule only the booking owned by the authenticated Buyer.
    const booking = await bookingService.rescheduleBooking(
      req.user._id,
      req.params.bookingId,
      req.body,
    );

    // Return the updated viewing request.
    return res.status(200).json({
      status: "success",
      data: {
        booking,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getAgencyBookings,
  cancelBooking,
  rescheduleBooking,
};