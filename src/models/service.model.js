const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    /*
     * One collection powers the complete Home Services domain.
     * The recordType tells us what the document represents.
     */
    recordType: {
      type: String,
      enum: [
        "category",
        "provider",
        "request",
        "booking",
        "transaction",
        "settings",
      ],
      required: true,
      index: true,
    },

    /*
     * Human-readable domain ID used by the dashboard.
     * Examples:
     * CAT-...
     * PRV-...
     * REQ-...
     * BKG-...
     */
    recordId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    /*
     * Shared fields.
     */
    name: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    icon: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      default: "Active",
      index: true,
    },

    /*
     * Category relationship.
     */
    category: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },

    /*
     * Provider fields.
     */
    verificationStatus: {
      type: String,
      default: "Pending",
    },

    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    contactPhone: {
      type: String,
      default: "",
      trim: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedJobs: {
      type: Number,
      default: 0,
      min: 0,
    },

    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
     * Service request fields.
     */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Emergency"],
      default: "Low",
      index: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    assignedProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true,
    },

    assignedProviderName: {
      type: String,
      default: "",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Booking relationship.
     *
     * Every Home Services booking can be traced
     * back to the service request that created it.
     */
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true,
    },

    /*
     * Booking fields.
     */
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true,
    },

    providerName: {
      type: String,
      default: "",
      trim: true,
    },

    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
     * Financial transaction fields.
     *
     * Financial records can be linked back to the
     * Home Services booking that generated them.
     */
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true,
    },

    transactionDate: {
      type: Date,
      default: null,
      index: true,
    },

    transactionDescription: {
      type: String,
      default: "",
      trim: true,
    },

    transactionType: {
      type: String,
      enum: [
        "Revenue",
        "Payout",
        "Refund",
        "Commission",
        "",
      ],
      default: "",
    },

    transactionStatus: {
      type: String,
      enum: [
        "Completed",
        "Pending",
        "Failed",
        "",
      ],
      default: "",
    },

    period: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Home Services configuration.
     */
    settings: {
      autoAssign: {
        type: Boolean,
        default: false,
      },

      manualApproval: {
        type: Boolean,
        default: true,
      },

      escalation: {
        type: Boolean,
        default: true,
      },

      areas: {
        type: [String],
        default: [
          "Lagos",
          "Abuja",
          "Port Harcourt",
        ],
      },

      notifications: {
        email: {
          type: Boolean,
          default: true,
        },

        push: {
          type: Boolean,
          default: true,
        },

        newRequests: {
          type: Boolean,
          default: true,
        },

        providerOnboarding: {
          type: Boolean,
          default: true,
        },
      },
    },

    /*
     * Audit ownership.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

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

serviceSchema.index({
  recordType: 1,
  status: 1,
});

serviceSchema.index({
  recordType: 1,
  category: 1,
});

serviceSchema.index({
  recordType: 1,
  createdAt: -1,
});

serviceSchema.index({
  recordType: 1,
  requestId: 1,
});

serviceSchema.index({
  recordType: 1,
  bookingId: 1,
});

serviceSchema.index({
  recordType: 1,
  transactionDate: -1,
});

module.exports = mongoose.model(
  "Service",
  serviceSchema,
);