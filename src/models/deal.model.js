// Import Mongoose so we can define the Deal schema and model.
const mongoose = require("mongoose");

// Define the Deal schema used for transactions created from accepted Offers.
const dealSchema = new mongoose.Schema(
  {
    // Human-readable Deal reference used across dashboards and reports.
    dealId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // The Offer that created this Deal.
    // One accepted Offer may create only one Deal.
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      unique: true,
      index: true,
    },

    // The Property involved in the transaction.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // The Buyer who submitted the accepted Offer.
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The Owner of the Property when the Property has an Owner.
    // Some platform-created Properties may not have an Owner account.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // The Agency responsible for the Property transaction.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true,
    },

    // The Agent responsible for the transaction.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },

    // Preserve the transaction type from the Property.
    transactionType: {
      type: String,
      enum: {
        values: ["buy", "rent", "lease"],
        message: "Invalid Deal transaction type",
      },
      required: true,
      index: true,
    },

    // Store the actual agreed transaction value.
    //
    // When an Owner counter offer is accepted, this should use
    // the accepted counter amount rather than the original offer amount.
    agreedAmount: {
      type: Number,
      required: true,
      min: [0, "Agreed amount cannot be negative"],
    },

    // Main Deal lifecycle.
//
// The Deal is created at Agreement Pending after an Offer
// reaches Accepted.
status: {
  type: String,
  enum: {
    values: [
      "Agreement Pending",
      "Agreement Completed",
      "Payment Pending",
      "Payment Verified",
      "Completed",
      "Cancelled",
    ],
    message: "Invalid Deal status",
  },
  default: "Agreement Pending",
  index: true,
},

    // Track whether the agreement stage has been completed.
    //
    // This is intentionally a workflow state only for now.
    // No fake contract/signature system is attached to it yet.
    agreementStatus: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
      index: true,
    },

    // Track the financial stage of the Deal.
    //
    // "Verified" means the financial workflow has confirmed
    // the required payment for the Deal. The actual payment
    // implementation will be added through the appropriate
    // Finance/Payment workflow.
    paymentStatus: {
      type: String,
      enum: ["Pending", "Verified"],
      default: "Pending",
      index: true,
    },

    // Record when the agreement stage was completed.
    agreementCompletedAt: {
      type: Date,
      default: null,
    },

    // Record which authenticated User completed the agreement stage.
    agreementCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Record when the payment stage was verified.
    paymentVerifiedAt: {
      type: Date,
      default: null,
    },

    // Record which authenticated User verified the payment.
    paymentVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Record when the Deal reached its final Completed state.
    completedAt: {
      type: Date,
      default: null,
    },

    // Record which authenticated User completed the Deal.
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Record when the Deal was cancelled.
    cancelledAt: {
      type: Date,
      default: null,
    },

    // Record which authenticated User cancelled the Deal.
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Preserve the reason when a Deal is cancelled.
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Cancellation reason cannot exceed 2000 characters",
      ],
      default: "",
    },
  },
  {
    // Automatically maintain createdAt and updatedAt.
    timestamps: true,
  },
);

// Index Deals by Agent for the Agent Dashboard.
dealSchema.index({
  agent: 1,
  createdAt: -1,
});

// Index Deals by Agency for the Agency Dashboard.
dealSchema.index({
  agency: 1,
  createdAt: -1,
});

// Index Deals by Buyer for the Buyer Dashboard.
dealSchema.index({
  buyer: 1,
  createdAt: -1,
});

// Index Deals by Owner for the Owner Dashboard.
dealSchema.index({
  owner: 1,
  createdAt: -1,
});

// Index Deal history by Property.
dealSchema.index({
  property: 1,
  createdAt: -1,
});

// Export the Deal model.
module.exports = mongoose.model("Deal", dealSchema);