const mongoose = require("mongoose");
const { COMMUNICATION } = require("../config/constants");

const participantStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Archive state belongs to one participant and must never hide a
    // conversation for the other authorized participants.
    archivedAt: {
      type: Date,
      default: null,
    },
    // Message persistence is introduced in the next phase.  This field is
    // intentionally prepared now, but no unread behaviour is inferred from it.
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(COMMUNICATION.CONVERSATION_TYPES),
      required: true,
      index: true,
    },
    directKey: {
  type: String,
  trim: true,
  default: null,
},
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      required: true,
      validate: {
        validator: (participants) => {
          const ids = participants.map((participant) => String(participant));
          return participants.length > 0 && new Set(ids).size === ids.length;
        },
        message: "Conversation participants must be unique",
      },
    },
    participantState: {
      type: [participantStateSchema],
      default: [],
      validate: {
        validator: function validateParticipantState(states) {
          const participantIds = this.participants.map((participant) =>
            String(participant),
          );
          const stateIds = states.map((state) => String(state.user));

          return (
            participantIds.length === stateIds.length &&
            new Set(stateIds).size === stateIds.length &&
            stateIds.every((stateId) => participantIds.includes(stateId))
          );
        },
        message: "Participant state must match conversation participants",
      },
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    inquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      default: null,
      index: true,
    },
    // Reserved nullable context references allow later, explicitly approved
    // workflows without requiring a destructive schema migration.
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(COMMUNICATION.CONVERSATION_STATUSES),
      default: COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // The Message model is intentionally not implemented in this phase.
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.pre("validate", function enforcePropertyInquiryContext() {
  if (this.type === COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY) {
    if (!this.inquiry) {
      throw new Error("A property inquiry conversation requires an inquiry");
    }

    if (!this.property) {
      throw new Error("A property inquiry conversation requires a property");
    }
  }
});

// Supports participant inbox retrieval ordered by recent activity.
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.index(
  { directKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      directKey: { $type: "string" },
    },
  },
);

// Enforce one active inquiry thread while allowing an explicitly closed
// conversation to remain as historical data.
conversationSchema.index(
  { type: 1, inquiry: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY,
      status: COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
      // Match the deployed index predicate exactly.  Using `$exists` here
      // creates an identically named but semantically different index on
      // databases that already have the ObjectId-scoped version.
      inquiry: { $type: "objectId" },
    },
  },
);

module.exports = mongoose.model("Conversation", conversationSchema);
