// Import Joi so we can validate incoming Booking requests.
const Joi = require("joi");

// Define the validation schema for creating a viewing request.
const createBookingSchema = Joi.object({
  // Validate the Property ID supplied by the Buyer.
  propertyId: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Property ID is required.",
      "any.required": "Property ID is required.",
    }),

  // Validate the requested viewing date.
  viewingDate: Joi.date()
    .iso()
    .required()
    .messages({
      "date.base": "Viewing date must be a valid date.",
      "any.required": "Viewing date is required.",
    }),

  // Validate the requested viewing time.
  viewingTime: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Viewing time is required.",
      "any.required": "Viewing time is required.",
    }),

  // Allow the Buyer to include an optional message.
  message: Joi.string()
    .trim()
    .max(1000)
    .allow("")
    .default(""),
});

// Export the Booking validation schema.
module.exports = {
  createBookingSchema,
};