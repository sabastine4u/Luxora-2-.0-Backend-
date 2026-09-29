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

// Define the workflow action contract used by Finance operations.
const mortgageWorkflowSchema = Joi.object({
  action: Joi.string()
    .valid(
      "start_verification",
      "complete_verification",
      "approve",
      "reject",
      "disburse",
    )
    .required(),

  approvedLoanAmount: Joi.number()
    .positive()
    .when("action", {
      is: "approve",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  interestRate: Joi.number()
    .min(0)
    .when("action", {
      is: "approve",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  loanTermYears: Joi.number()
    .integer()
    .min(1)
    .when("action", {
      is: "approve",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  monthlyPayment: Joi.number()
    .positive()
    .when("action", {
      is: "approve",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  rejectionReason: Joi.string()
    .trim()
    .max(2000)
    .when("action", {
      is: "reject",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
});

// Export the Mortgage Application validation schemas.
module.exports = {
  createMortgageApplicationSchema,
  mortgageWorkflowSchema,
};