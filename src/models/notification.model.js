const mongoose = require("mongoose");
const { NOTIFICATION } = require("../config/constants");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION.TYPES,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: NOTIFICATION.CATEGORIES,
      required: true,
    },
    priority: {
      type: String,
      enum: NOTIFICATION.PRIORITIES,
      default: "normal",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Notification title cannot exceed 200 characters"],
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Notification body cannot exceed 2000 characters"],
    },
    resourceType: {
      type: String,
      enum: NOTIFICATION.RESOURCE_TYPES,
      default: null,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
    inquiry: { type: mongoose.Schema.Types.ObjectId, ref: "Inquiry", default: null },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    readAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    dedupeKey: {
      type: String,
      trim: true,
      maxlength: [255, "Notification dedupe key cannot exceed 255 characters"],
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.pre("validate", function validateResourceReference() {
  const hasResourceType = Boolean(this.resourceType);
  const hasResourceId = Boolean(this.resourceId);

  if (hasResourceType !== hasResourceId) {
    throw new Error("Notification resourceType and resourceId must be provided together");
  }

  if (hasResourceType && this[this.resourceType] && String(this[this.resourceType]) !== String(this.resourceId)) {
    throw new Error("Notification resource reference must match resourceType and resourceId");
  }
});

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, archivedAt: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, sparse: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
