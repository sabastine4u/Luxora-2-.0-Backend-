// Import Joi so we can validate Mortgage Application payloads.
const Joi = require("joi");

// Define the validation schema used when a Buyer creates a Mortgage Application.
const createMortgageApplicationSchema = Joi.object({
  // Validate the Property the Buyer wants to finance.
  propertyId: Joi.string()
    .trim()
    .required(),

  // Validate the mortgage lender selected by the Buyer.
  lender: Joi.string()
    .trim()
    .max(150)
    .allow("")
    .default(""),

  // Validate the loan amount requested by the Buyer.
  requestedLoanAmount: Joi.number()
    .min(0)
    .required(),

  // Validate the optional interest rate supplied for the application.
  interestRate: Joi.number()
    .min(0)
    .allow(null)
    .default(null),

  // Validate the optional repayment duration.
  loanTermYears: Joi.number()
    .integer()
    .min(1)
    .allow(null)
    .default(null),
});

// Export the Mortgage Application validation schemas.
module.exports = {
  createMortgageApplicationSchema,
};