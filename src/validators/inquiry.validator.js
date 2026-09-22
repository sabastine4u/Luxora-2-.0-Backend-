const Joi = require("joi");

const createInquirySchema = Joi.object({
  propertyId: Joi.string().hex().length(24).required(),
  // Accepted for backwards-compatible public payloads, but intentionally
  // ignored by the service: authenticated identity always comes from JWT.
  inquirer: Joi.string().hex().length(24).optional(),
  fullName: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().trim().email().max(160).required(),
  phone: Joi.string().trim().min(1).max(40).required(),
  message: Joi.string().trim().min(1).max(2000).required(),
  source: Joi.string().valid("Contact Agent", "Schedule Viewing", "Website").default("Contact Agent"),
  preferredDate: Joi.date().allow(null).default(null),
  preferredTime: Joi.string().trim().max(80).allow(null, "").default(null),
}).unknown(false);

module.exports = {
  createInquirySchema,
};
