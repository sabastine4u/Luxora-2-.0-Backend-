const mongoose = require('mongoose');

const verificationDocumentSchema = new mongoose.Schema(
  {
    // Human-readable document name, e.g. "Real Estate License".
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Document category used by the verification workflow.
    type: {
      type: String,
      required: true,
      trim: true,
    },

    // Public URL for viewing/downloading the uploaded document.
    url: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional stored filename from the upload system.
    filename: {
      type: String,
      trim: true,
      default: null,
    },

    // Optional document size for the Admin UI.
    size: {
      type: String,
      trim: true,
      default: null,
    },

    // Track the individual document's review result.
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },

    // Optional explanation when the document is rejected.
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Store when this document was uploaded.
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const verificationHistorySchema = new mongoose.Schema(
  {
    // Action performed on the verification record.
    action: {
      type: String,
      enum: [
        'Submitted',
        'Resubmitted',
        'Approved',
        'Rejected',
        'Revoked',
      ],
      required: true,
    },

    // Optional explanation attached to this history event.
    notes: {
      type: String,
      trim: true,
      default: null,
    },

    // Admin/Super Admin who performed the action.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // When the action occurred.
    performedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const verificationSchema = new mongoose.Schema(
  {
    // The Agent whose credentials are being verified.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
      index: true,
    },

    // The User account linked to the Agent profile.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The Agency the Agent belongs to.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
      index: true,
    },

    // Current overall verification state.
    status: {
      type: String,
      enum: [
        'Pending',
        'Verified',
        'Rejected',
        'Revoked',
      ],
      default: 'Pending',
      index: true,
    },

    // Highest verification level currently achieved.
    verificationLevel: {
      type: String,
      enum: [
        'Unverified',
        'Agent Reviewed',
        'Documents Verified',
        'Inspection Verified',
        'Premium Verified',
      ],
      default: 'Unverified',
    },

    // Documents submitted by the Agent for verification.
    documents: {
      type: [verificationDocumentSchema],
      default: [],
    },

    // Admin/Super Admin review notes.
    reviewNotes: {
      type: String,
      trim: true,
      default: null,
    },

    // Reason supplied when the verification is rejected.
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Admin/Super Admin who most recently reviewed the verification.
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Timestamp of the most recent review.
    reviewedAt: {
      type: Date,
      default: null,
    },

    // Timestamp when the verification was approved.
    verifiedAt: {
      type: Date,
      default: null,
    },

    // Optional expiry date for future credential renewal workflows.
    expiresAt: {
      type: Date,
      default: null,
    },

    // Complete audit trail for verification decisions.
    history: {
      type: [verificationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Keep verification records easy to locate by status and creation time.
verificationSchema.index({
  status: 1,
  createdAt: -1,
});

// Keep expiry-based Admin queries efficient later.
verificationSchema.index({
  expiresAt: 1,
});

module.exports = mongoose.model(
  'Verification',
  verificationSchema
);