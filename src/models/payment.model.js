const mongoose = require("mongoose");

// Define the schema for a rental payment received from a tenant.
const paymentSchema = new mongoose.Schema(
  {
    // Store the Owner receiving the rental income.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Store the tenant who made the payment.
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Store the Property associated with the rental payment.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Store the amount paid by the tenant.
    amount: {
      type: Number,
      required: true,
      min: [0, "Payment amount cannot be negative"],
    },

    // Store the period this payment covers.
    paymentPeriod: {
      type: String,
      trim: true,
      maxlength: [100, "Payment period cannot exceed 100 characters"],
      required: true,
    },

    // Track the current payment status.
    status: {
      type: String,
      enum: {
        values: ["Pending", "Paid", "Overdue", "Failed"],
        message: "Invalid payment status",
      },
      default: "Pending",
      index: true,
    },

    // Record when the payment was actually received.
    paidAt: {
      type: Date,
      default: null,
    },

    // Record an optional transaction/reference number.
    reference: {
      type: String,
      trim: true,
      maxlength: [200, "Payment reference cannot exceed 200 characters"],
      default: "",
    },

    // Store optional notes related to the payment.
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Payment notes cannot exceed 2000 characters"],
      default: "",
    },
  },
  {
    // Automatically create createdAt and updatedAt timestamps.
    timestamps: true,
  }
);

// Export the Payment model for use by the payment service.
module.exports = mongoose.model("Payment", paymentSchema);