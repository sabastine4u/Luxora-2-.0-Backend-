const Joi = require("joi");

const propertyStatuses = ["Draft", "Pending Review", "Approved", "Published", "Under Offer", "Sold", "Rented", "Leased", "Archived"];

const querySchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso().min(Joi.ref("from")),
  city: Joi.string().trim().max(120),
  state: Joi.string().trim().max(120),
  area: Joi.string().trim().max(120),
  propertyType: Joi.string().trim().max(120),
  transactionType: Joi.string().valid("buy", "rent", "lease"),
  status: Joi.string().valid(...propertyStatuses),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(Joi.ref("minPrice")),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  metric: Joi.string().valid("price", "rent").default("price"),
});

const validateQuery = (query) => {
  const { error, value } = querySchema.validate(query, { abortEarly: false, convert: true, stripUnknown: true });
  if (error) {
    const AppError = require("../utils/AppError");
    throw new AppError(error.details.map((detail) => detail.message).join(", "), 400);
  }
  return value;
};

module.exports = { validateQuery };
