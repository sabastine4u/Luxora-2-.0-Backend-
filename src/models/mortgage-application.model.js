// Import Mongoose so we can define the Mortgage Application schema.
const mongoose = require("mongoose");

// Define the lifecycle stages used to track a Buyer's mortgage application.
const mortgageStageSchema = new mongoose.Schema(
  {
    // Store the name of the application stage.
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Store the date associated with the stage.
    date: {
      type: Date,
      default: null,
    },

    // Record the internal user who completed this stage.
completedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},


    // Track whether the stage has been completed.
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

// Define the Mortgage Application schema used by the Buyer Dashboard.
const mortgageApplicationSchema = new mongoose.Schema(
  {
    // Link the application to the Buyer who submitted it.
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Link the application to the Property being financed.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },

    // Store the selected mortgage lender.
    lender: {
      type: String,
      trim: true,
      default: "",
    },

    // Store the amount requested by the Buyer.
    requestedLoanAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Store the amount approved by the lender.
    approvedLoanAmount: {
      type: Number,
      min: 0,
      default: null,
    },

    // Store the annual interest rate offered by the lender.
    interestRate: {
      type: Number,
      min: 0,
      default: null,
    },

    // Store the repayment duration in years.
    loanTermYears: {
      type: Number,
      min: 1,
      default: null,
    },

    // Store the calculated monthly repayment.
    monthlyPayment: {
      type: Number,
      min: 0,
      default: null,
    },

    // Track the current mortgage application status.
    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Document Verification",
        "Credit Assessment",
        "Approved",
        "Rejected",
        "Disbursed",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },

    // Store the current application timeline.
    stages: {
      type: [mortgageStageSchema],
      default: [],
    },

    // Store when the application was approved.
    approvedAt: {
      type: Date,
      default: null,
    },

    // Store when the loan was actually disbursed.
    disbursedAt: {
      type: Date,
      default: null,
    },

    // Store the internal user who rejected the application, when applicable.
rejectedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

// Store when the application was rejected.
rejectedAt: {
  type: Date,
  default: null,
},

// Store the reason supplied by the Finance reviewer when rejecting.
rejectionReason: {
  type: String,
  trim: true,
  default: "",
},

  },
  {
    // Automatically maintain createdAt and updatedAt.
    timestamps: true,
  },
);

// Export the Mortgage Application model.
module.exports = mongoose.model(
  "MortgageApplication",
  mortgageApplicationSchema,
);