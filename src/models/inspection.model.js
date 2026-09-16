const mongoose = require("mongoose");

const inspectionSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "TenantOccupancy", default: null },
    unit: { type: String, default: null, trim: true, maxlength: 100 },
    scheduledAt: { type: Date, required: [true, "Inspection schedule is required"], index: true },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    inspectorName: { type: String, default: null, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: { values: ["Move-in", "Move-out", "Routine", "Emergency"], message: "Invalid inspection type" },
      required: [true, "Inspection type is required"],
    },
    status: {
      type: String,
      enum: { values: ["Scheduled", "Completed", "Pending Review", "Cancelled"], message: "Invalid inspection status" },
      default: "Scheduled",
      index: true,
    },
    score: { type: Number, default: null, min: 0, max: 100 },
    findings: { type: [String], default: [] },
    reportUrl: { type: String, default: null, trim: true },
    documents: [
      {
        title: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inspectionSchema.index({ property: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model("Inspection", inspectionSchema);
