const mongoose = require("mongoose");

// Payment remains the source of truth for rent. This ledger records only the
// non-rent income categories exposed by the existing Property Manager UI.
const incomeSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    category: {
      type: String,
      enum: { values: ["Late Fee", "Security Deposit", "Other"], message: "Invalid income category" },
      required: [true, "Income category is required"],
    },
    amount: { type: Number, required: [true, "Income amount is required"], min: [0, "Income amount cannot be negative"] },
    incomeDate: { type: Date, required: [true, "Income date is required"] },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

incomeSchema.index({ property: 1, incomeDate: -1 });

module.exports = mongoose.model("Income", incomeSchema);
