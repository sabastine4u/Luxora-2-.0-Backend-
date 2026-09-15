const mongoose = require("mongoose");

// Define an analytics event for a Property detail-page view.
const propertyViewSchema = new mongoose.Schema(
  {
    // Store which Property was viewed.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Store an anonymous browser identifier for duplicate-view protection.
    visitorId: {
      type: String,
      trim: true,
      required: true,
      maxlength: [200, "Visitor ID cannot exceed 200 characters"],
      index: true,
    },

    // Record exactly when the Property was viewed.
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Support fast recent-view checks for the same visitor and Property.
propertyViewSchema.index({
  property: 1,
  visitorId: 1,
  viewedAt: -1,
});

// Export the PropertyView model for analytics tracking.
module.exports = mongoose.model("PropertyView", propertyViewSchema);