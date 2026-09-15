const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    /*
     * Singleton key.
     *
     * Luxora should have only one global
     * system-settings document.
     */
    key: {
      type: String,
      unique: true,
      default: "global",
      immutable: true,
    },

    /*
     * Standard Luxora platform fee charged
     * against completed property transaction GMV.
     */
    platformFee: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 5,
    },

    /*
     * Platform-wide default currency.
     */
    currency: {
      type: String,
      enum: ["NGN", "USD", "GBP"],
      default: "NGN",
    },

    /*
     * When enabled, the platform can enter
     * maintenance mode.
     */
    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    /*
     * Track who most recently changed the
     * global configuration.
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  "SystemSettings",
  systemSettingsSchema,
);