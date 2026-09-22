const mongoose = require("mongoose");

// Define the Inquiry record created when a property seeker contacts an agent.
const inquirySchema = new mongoose.Schema(
  {
    // Store the Property that the inquiry is about.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Store the Agency responsible for the Property when one exists.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true,
    },

    // Store the Agent currently assigned to the Property.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },

    // Store the Property Owner associated with the listing.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Store the authenticated inquirer when the seeker is logged in.
    inquirer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Authenticated inquiry retries are scoped to the resolved User identity.
    // Anonymous inquiries intentionally do not require an idempotency key.
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: [255, "Idempotency key cannot exceed 255 characters"],
    },

    // Store the name supplied by the person making the inquiry.
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, "Full name cannot exceed 120 characters"],
    },

    // Store the email supplied by the person making the inquiry.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: [160, "Email cannot exceed 160 characters"],
    },

    // Store the phone number supplied by the person making the inquiry.
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: [40, "Phone number cannot exceed 40 characters"],
    },

    // Store the actual message sent by the property seeker.
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    // Store the current lead/inquiry stage.
    // This is intentionally separate from appointmentStatus.
    status: {
      type: String,
      enum: {
        values: [
          "New",
          "Contacted",
          "Viewing Scheduled",
          "Negotiating",
          "Closed",
          "Lost",
        ],
        message: "Invalid inquiry status",
      },
      default: "New",
      index: true,
    },

    // Store where the inquiry originated.
    source: {
      type: String,
      enum: {
        values: ["Contact Agent", "Schedule Viewing", "Website"],
        message: "Invalid inquiry source",
      },
      default: "Contact Agent",
    },

    // Store a requested viewing date when supplied by the seeker.
    preferredDate: {
      type: Date,
      default: null,
    },

    // Store the requested viewing time.
    preferredTime: {
      type: String,
      trim: true,
      maxlength: [80, "Preferred time cannot exceed 80 characters"],
      default: null,
    },

    // Store the confirmed viewing date selected by the Agent.
    scheduledDate: {
      type: Date,
      default: null,
    },

    // Store the confirmed viewing time selected by the Agent.
    scheduledTime: {
      type: String,
      trim: true,
      maxlength: [80, "Scheduled time cannot exceed 80 characters"],
      default: null,
    },

    // Store the lifecycle state of the actual appointment.
    // This is separate from the Lead status above.
    //
    // Example:
    // Lead status         = "Negotiating"
    // Appointment status  = "Scheduled"
    //
    // This prevents completing/cancelling a viewing from
    // accidentally changing the Lead pipeline stage.
    appointmentStatus: {
      type: String,
      enum: {
        values: ["Scheduled", "Completed", "Cancelled"],
        message: "Invalid appointment status",
      },
      default: "Scheduled",
      index: true,
    },

    // Store the first time the Agent moved the Lead from New to an active contact stage.
    // This will later allow real response-time analytics.
    firstContactedAt: {
      type: Date,
      default: null,
    },

    // Store the most recent Lead activity timestamp.
    // This becomes the foundation for future follow-up intelligence.
    lastActivityAt: {
      type: Date,
      default: null,
    },

    // Store Agent notes attached to the Lead.
    notes: [
      {
        // Store the note text entered by the Agent.
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [2000, "Lead note cannot exceed 2000 characters"],
        },

        // Store the User who created the note.
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        // Automatically record when the note was created.
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Store the history of meaningful Lead actions.
    // This allows the dashboard to show real Lead activity later.
    activities: [
      {
        // Identify what happened to the Lead.
        action: {
          type: String,
          enum: {
            values: [
              "Created",
              "Contacted",
              "Status Changed",
              "Note Added",
              "Viewing Scheduled",
              "Viewing Rescheduled",
              "Viewing Cancelled",
              "Viewing Completed",
            ],
            message: "Invalid Lead activity",
          },
          required: true,
        },

        // Store an optional description of the activity.
        description: {
          type: String,
          trim: true,
          maxlength: [
            2000,
            "Activity description cannot exceed 2000 characters",
          ],
          default: null,
        },

        // Store the User responsible for the action.
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },

        // Record when the activity happened.
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    // Automatically maintain createdAt and updatedAt timestamps.
    timestamps: true,
  },
);

// Support fast Agency inquiry lists grouped by Property and newest date.
inquirySchema.index({
  agency: 1,
  property: 1,
  createdAt: -1,
});

// Support Agent lead/inquiry pipeline queries.
inquirySchema.index({
  agent: 1,
  status: 1,
  createdAt: -1,
});

// Support Agent appointment queries by scheduled date and appointment status.
inquirySchema.index({
  agent: 1,
  scheduledDate: 1,
  appointmentStatus: 1,
});

inquirySchema.index(
  { inquirer: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      // `$ne` is not supported in a partial-index expression by the deployed
      // MongoDB version.  The BSON type predicate is the precise supported
      // equivalent for authenticated User ObjectIds.
      inquirer: { $type: "objectId" },
      idempotencyKey: { $type: "string" },
    },
  },
);

// Export the Inquiry model for controllers, services, and analytics.
module.exports = mongoose.model("Inquiry", inquirySchema);
