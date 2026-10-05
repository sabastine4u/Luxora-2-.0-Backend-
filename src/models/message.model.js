const mongoose = require("mongoose");

const readBySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["text", "system", "event"],
      default: "text",
      required: true,
    },
    context: {
  type: {
    type: String,
    enum: [
      "property",
      "inquiry",
      "booking",
      "offer",
      "deal",
    ],
    default: null,
  },

  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
},
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    // Reserved for server-orchestrated messages only; public request schemas
    // deliberately do not accept this field.
    dedupeKey: {
      type: String,
      trim: true,
      maxlength: [255, "Message dedupe key cannot exceed 255 characters"],
    },
    // This supports future per-message receipts.  The first release uses the
    // Conversation participant read boundary for efficient inbox read state.
    readBy: {
      type: [readBySchema],
      default: [],
      validate: {
        validator: (entries) => {
          const ids = entries.map((entry) => String(entry.user));
          return new Set(ids).size === ids.length;
        },
        message: "A user can only have one read receipt per message",
      },
    },
  },
  { timestamps: true },
);

// Supports stable newest-first conversation history pagination.
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
messageSchema.index(
  { conversation: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

module.exports = mongoose.model("Message", messageSchema);
