const mongoose = require("mongoose");

// Store the tenancy/occupancy relationship separately from a Luxora User.
// A tenant may be linked to a User account, but an account is not required.
const tenantOccupancySchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    tenantUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
      maxlength: [200, "Tenant name cannot exceed 200 characters"],
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: [50, "Phone number cannot exceed 50 characters"],
    },
    unit: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, "Unit cannot exceed 100 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["Active", "Moving Out", "Eviction", "Past"],
        message: "Invalid occupancy status",
      },
      default: "Active",
      index: true,
    },
    moveInDate: { type: Date, default: null },
    moveOutDate: { type: Date, default: null },
    lease: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lease",
      default: null,
    },
  },
  { timestamps: true },
);

tenantOccupancySchema.index({ property: 1, status: 1 });

module.exports = mongoose.model("TenantOccupancy", tenantOccupancySchema);
