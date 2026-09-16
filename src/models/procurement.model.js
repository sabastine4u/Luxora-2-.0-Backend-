const mongoose = require("mongoose");

// A single, typed ledger keeps related procurement records together without
// creating a disconnected collection for every dashboard tab.
const procurementSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: ["vendor", "rfq", "request", "order", "contract", "inventory", "asset", "invoice", "budget", "payment"],
      required: true,
      index: true,
    },
    recordId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 4000 },
    status: { type: String, default: "Draft", trim: true, index: true },
    category: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 3 },
    quantity: { type: Number, default: null, min: 0 },
    dueDate: { type: Date, default: null },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Procurement", default: null, index: true },
    vendorName: { type: String, default: "", trim: true },
    relatedRecord: { type: mongoose.Schema.Types.ObjectId, ref: "Procurement", default: null, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    attachmentUrl: { type: String, default: null, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

procurementSchema.index({ recordType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Procurement", procurementSchema);
