// Import Mongoose so we can define the Commission schema.
const mongoose = require("mongoose");

// Define the Commission record created from a finalized Agency transaction.
const commissionSchema = new mongoose.Schema(
  {
    // Human-readable commission reference used by the Agency dashboard.
    commissionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // Agency that owns the commission.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },

    // Agent responsible for the transaction.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },

    // Property involved in the completed transaction.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Accepted Offer that produced the transaction.
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },

    // Final value of the transaction.
    dealValue: {
      type: Number,
      required: true,
      min: 0,
    },

    // Agency fee amount that forms the commission pool.
    commissionPool: {
      type: Number,
      required: true,
      min: 0,
    },

    // Agent's configured percentage at the time of commission creation.
    agentSharePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Agency's configured percentage at the time of commission creation.
    agencySharePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Calculated amount payable to the Agent.
    agentAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Calculated amount retained by the Agency.
    agencyAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Track the lifecycle of the commission payment.
    status: {
      type: String,
      enum: [
        "Pending",
        "Processing",
        "Paid",
        "Overdue",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    // Expected payment date when one has been set.
    dueDate: {
      type: Date,
      default: null,
    },

    // Actual payment date once the commission has been paid.
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically maintain createdAt and updatedAt.
    timestamps: true,
  },
);

// Keep Agency commission listings fast.
commissionSchema.index({
  agency: 1,
  createdAt: -1,
});

// Export the Commission model.
module.exports = mongoose.model("Commission", commissionSchema);