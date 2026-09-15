const mongoose = require("mongoose");

const reportArchiveSchema = new mongoose.Schema(
  {
    // Human-readable report name shown in the Admin Reports page.
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Report category used by the existing report system.
    category: {
      type: String,
      required: true,
      enum: [
        "financial",
        "user-growth",
        "listing-performance",
        "system-audit",
      ],
      index: true,
    },

    // Optional date range used when the report was generated.
    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    // Store the exact report result at the moment it was generated.
    // This makes the archive an immutable snapshot rather than a live query.
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Number of bytes represented by the generated export when available.
    // This can remain null until actual file export is implemented.
    fileSize: {
      type: Number,
      default: null,
    },

    // Export format associated with the archived report.
    format: {
      type: String,
      enum: ["snapshot", "csv", "pdf"],
      default: "snapshot",
    },

    // Admin/Super Admin who generated the report.
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    generatedByName: {
      type: String,
      trim: true,
      default: null,
    },

    generatedByRole: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

reportArchiveSchema.index({
  category: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ReportArchive", reportArchiveSchema);