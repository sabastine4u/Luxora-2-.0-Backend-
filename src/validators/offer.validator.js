// Import Joi so we can validate incoming Offer request payloads.
const Joi = require("joi");

// Define the validation schema for creating a Buyer Offer.
const createOfferSchema = Joi.object({
  // Require the Property ID the Buyer wants to make an offer on.
  propertyId: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Property ID is required",
      "any.required": "Property ID is required",
    }),

  // Require a positive amount for the Buyer's offer.
  offerAmount: Joi.number()
    .positive()
    .required()
    .messages({
      "number.base": "Offer amount must be a number",
      "number.positive": "Offer amount must be greater than zero",
      "any.required": "Offer amount is required",
    }),

  // Allow the Buyer to attach an optional negotiation note.
  buyerNotes: Joi.string()
    .trim()
    .max(2000)
    .allow("")
    .default(""),
});

// Export the Offer validation schema for the controller to use.
module.exports = {
  createOfferSchema,
};