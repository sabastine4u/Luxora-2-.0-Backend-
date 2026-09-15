// Import Mongoose so we can define the Offer schema and model.
const mongoose = require("mongoose");

// Define the Offer schema used to store Buyer purchase offers.
const offerSchema = new mongoose.Schema(
  {
    // Store the Buyer who submitted the offer.
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Store the Property the Buyer is making an offer on.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Store the Agent responsible for handling the property negotiation.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },

    // Store the Agency associated with the property transaction.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true,
    },

    // Store the amount offered by the Buyer.
    offerAmount: {
      type: Number,
      required: true,
      min: [0, "Offer amount cannot be negative"],
    },

    // Store the Buyer's message or negotiation note attached to the offer.
    buyerNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Buyer notes cannot exceed 2000 characters"],
      default: "",
    },

    // Store the latest note supplied by the Agent during negotiation.
    agentNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Agent notes cannot exceed 2000 characters"],
      default: "",
    },

    // Store the current offer lifecycle state.
    status: {
      type: String,
      enum: {
        values: [
          "Draft",
          "Submitted",
          "Under Review",
          "Counter Offer Received",
          "Accepted",
          "Rejected",
          "Withdrawn",
          "Expired",
        ],
        message: "Invalid offer status",
      },
      default: "Draft",
      index: true,
    },

    // Store the latest counter-offer amount when the Agent counters the Buyer.
    counterOfferAmount: {
      type: Number,
      min: [0, "Counter offer amount cannot be negative"],
      default: null,
    },

    // Store any explanation attached to the latest counter offer.
    counterOfferDetails: {
      type: String,
      trim: true,
      maxlength: [2000, "Counter offer details cannot exceed 2000 characters"],
      default: "",
    },

    // Store the expected closing timeline when one has been provided.
    estimatedClosing: {
      type: String,
      trim: true,
      maxlength: [500, "Estimated closing cannot exceed 500 characters"],
      default: "",
    },

    // Store the date on which the offer expires when an expiry is defined.
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps.
    timestamps: true,
  },
);

// Index Buyer offer history so the Buyer dashboard can retrieve offers efficiently.
offerSchema.index({
  buyer: 1,
  createdAt: -1,
});

// Index Property negotiations so Agents and Agencies can retrieve offers efficiently.
offerSchema.index({
  property: 1,
  createdAt: -1,
});

// Export the Offer model so controllers and services can use it.
module.exports = mongoose.model("Offer", offerSchema);