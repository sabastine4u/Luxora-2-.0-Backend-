const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    /*
     * Complaint category shown in the Admin UI.
     */
    type: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Full complaint submitted by the user.
     */
    description: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Actual Luxora user when the complaint
     * is linked to an authenticated account.
     *
     * Kept optional because the UI supports
     * anonymous complaints.
     */
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /*
     * Snapshot used for display even when the
     * reporter is anonymous or later changes
     * their profile name.
     */
    reporterName: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * What the complaint concerns.
     */
    targetType: {
      type: String,
      enum: [
        "Property",
        "Agent",
        "Agency",
        "User",
        "Platform",
      ],
      required: true,
    },

    /*
     * Actual MongoDB object involved when there
     * is one. Platform complaints may not have
     * a target document.
     */
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /*
     * Display name of the target.
     */
    targetName: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Complaint lifecycle.
     */
    status: {
      type: String,
      enum: [
        "Open",
        "In Progress",
        "Escalated",
        "Resolved",
        "Closed",
      ],
      default: "Open",
      index: true,
    },

    /*
     * Operational priority.
     */
    priority: {
      type: String,
      enum: [
        "High",
        "Medium",
        "Low",
      ],
      default: "Medium",
      index: true,
    },

    /*
     * Admin/moderator currently responsible
     * for the complaint.
     */
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /*
     * Admin's final resolution.
     */
    resolutionSummary: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Internal notes that are not shown
     * to the reporting user.
     */
    internalNotes: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Lifecycle timestamps.
     */
    resolvedAt: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    escalatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/*
 * Useful indexes for the Admin Complaints page.
 */
complaintSchema.index({
  status: 1,
  priority: 1,
  createdAt: -1,
});

complaintSchema.index({
  assignedTo: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Complaint",
  complaintSchema,
);