const mongoose = require("mongoose");

const leaseSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenantOccupancy",
      required: true,
      index: true,
    },
    unit: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, "Unit cannot exceed 100 characters"],
    },
    startDate: { type: Date, required: [true, "Lease start date is required"] },
    endDate: { type: Date, required: [true, "Lease end date is required"] },
    monthlyRent: {
      type: Number,
      required: [true, "Monthly rent is required"],
      min: [0, "Monthly rent cannot be negative"],
    },
    deposit: { type: Number, default: 0, min: [0, "Deposit cannot be negative"] },
    status: {
      type: String,
      enum: {
        values: ["Active", "Expiring Soon", "Expired", "Renewed", "Terminated"],
        message: "Invalid lease status",
      },
      default: "Active",
      index: true,
    },
    terminationReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2000, "Termination reason cannot exceed 2000 characters"],
    },
    terminatedAt: { type: Date, default: null },
    documents: [
      {
        title: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

leaseSchema.index({ property: 1, status: 1, endDate: 1 });
leaseSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model("Lease", leaseSchema);
