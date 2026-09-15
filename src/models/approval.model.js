// Import Mongoose so we can define the Approval schema and model.
const mongoose = require('mongoose');

// Define the Approval schema used to track Property review decisions.
const approvalSchema = new mongoose.Schema(
  {
    // Reference the Property that is being submitted for approval.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property reference is required'],
    },

    // Record the User who submitted the Property for review.
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitter is required'],
    },

    // Record the role of the User who submitted the Property.
    submittedByRole: {
      type: String,
      enum: {
        values: ['Agent', 'Admin', 'Super Admin'],
        message: 'Invalid submitter role',
      },
      required: [true, 'Submitter role is required'],
    },

    // Store the current approval decision for the Property.
    status: {
      type: String,
      enum: {
        values: [
          'Pending',
          'Approved',
          'Rejected',
        ],
        message: 'Invalid approval status',
      },
      default: 'Pending',
    },

    // Store the User who reviewed or decided the approval request.
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Store the date when the approval decision was made.
    reviewedAt: {
      type: Date,
      default: null,
    },

    // Store the reviewer's explanation or rejection reason.
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        'Review notes cannot exceed 2000 characters',
      ],
      default: null,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps.
    timestamps: true,
  }
);

// Index the Property reference for fast approval lookups.
approvalSchema.index({
  property: 1,
});

// Index approval status for review-queue queries.
approvalSchema.index({
  status: 1,
});

// Index the submitter for dashboard and audit queries.
approvalSchema.index({
  submittedBy: 1,
});

// Export the Approval model so services and controllers can use it.
module.exports = mongoose.model('Approval', approvalSchema);