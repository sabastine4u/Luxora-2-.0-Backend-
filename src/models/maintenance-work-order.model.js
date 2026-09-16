const mongoose = require("mongoose");

const maintenanceWorkOrderSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "TenantOccupancy", default: null },
    unit: { type: String, default: null, trim: true, maxlength: 100 },
    title: { type: String, required: [true, "Work order title is required"], trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    priority: {
      type: String,
      enum: { values: ["Low", "Medium", "High", "Emergency"], message: "Invalid work order priority" },
      default: "Low",
      index: true,
    },
    status: {
      type: String,
      enum: { values: ["Open", "Assigned", "In Progress", "Resolved", "Closed", "Cancelled"], message: "Invalid work order status" },
      default: "Open",
      index: true,
    },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Procurement", default: null },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    estimatedCost: { type: Number, default: null, min: [0, "Estimated cost cannot be negative"] },
    actualCost: { type: Number, default: null, min: [0, "Actual cost cannot be negative"] },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

maintenanceWorkOrderSchema.index({ property: 1, status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model("MaintenanceWorkOrder", maintenanceWorkOrderSchema);
