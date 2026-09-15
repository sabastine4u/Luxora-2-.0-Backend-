const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // The authenticated user who performed the action.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Snapshot of the actor's name at the time of the event.
    actorName: {
      type: String,
      required: true,
      trim: true,
    },

    // Snapshot of the actor's role at the time of the event.
    actorRole: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Machine-readable action name.
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Broad area of the platform where the action happened.
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Human-readable explanation shown to Admins.
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional target information.
    targetType: {
      type: String,
      default: null,
      trim: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    targetName: {
      type: String,
      default: null,
      trim: true,
    },

    // Store useful before/after or contextual data without
    // forcing every audit event into the same structure.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Request information useful for security investigations.
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },

    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

auditLogSchema.index({
  category: 1,
  createdAt: -1,
});

auditLogSchema.index({
  actor: 1,
  createdAt: -1,
});

auditLogSchema.index({
  action: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "AuditLog",
  auditLogSchema,
);