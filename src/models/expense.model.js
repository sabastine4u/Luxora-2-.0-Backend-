const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    category: {
      type: String,
      enum: {
        values: ["Maintenance", "Taxes", "Insurance", "Utilities", "Management Fee", "Other"],
        message: "Invalid expense category",
      },
      required: [true, "Expense category is required"],
    },
    amount: { type: Number, required: [true, "Expense amount is required"], min: [0, "Expense amount cannot be negative"] },
    expenseDate: { type: Date, required: [true, "Expense date is required"] },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    vendorName: { type: String, default: null, trim: true, maxlength: 200 },
    receiptUrl: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: { values: ["Pending", "Approved", "Rejected"], message: "Invalid expense status" },
      default: "Pending",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

expenseSchema.index({ property: 1, status: 1, expenseDate: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
