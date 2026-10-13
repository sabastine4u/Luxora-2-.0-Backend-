
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../config/constants");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.BUYER,
    },

    // Store the public URL of the user's current profile picture.
    avatar: {
      type: String,
      default: null,
      trim: true,
    },

    department: {
      type: String,
      default: null,
    },

    // Existing verification fields.
    // These remain unchanged because other Luxora roles use them.
    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    // Email ownership verification is tracked separately
    // from the existing account/credential verification.
    // Existing and administrator-created accounts remain compatible.
    emailVerified: {
      type: Boolean,
      default: true,
    },

    // Store only a hash of the email verification code.
    emailVerificationCodeHash: {
      type: String,
      default: null,
      select: false,
    },

    // Verification codes expire after the configured period.
    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    // Prevent repeated verification-email requests in a short period.
    emailVerificationSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    // Track failed verification attempts.
    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // Track the last successful sign-in for security notifications.
    lastLoginAt: {
      type: Date,
      default: null,
    },

    // Browser/device information from the User-Agent header.
    lastLoginDevice: {
      type: String,
      default: null,
      select: false,
    },

    // Track the previous IP address for sign-in alerts.
    lastLoginIp: {
      type: String,
      default: null,
      select: false,
    },

    // Existing password-reset fields.
    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    // Store the user's optional phone number.
    phone: {
      type: String,
      trim: true,
      default: null,
    },

    // Existing dashboard preferences.
    settings: {
      // Buyer-specific property search preferences.
      buyer: {
        purpose: {
          type: String,
          enum: ["buy", "rent", "short-let"],
          default: "buy",
        },

        propertyTypes: {
          type: [String],
          default: [],
        },

        preferredLocations: {
          type: [String],
          default: [],
        },

        budgetMin: {
          type: Number,
          default: null,
        },

        budgetMax: {
          type: Number,
          default: null,
        },

        minBedrooms: {
          type: Number,
          default: null,
        },

        minBathrooms: {
          type: Number,
          default: null,
        },
      },

      // Owner-specific business, payout, and tax settings.
      owner: {
        businessName: {
          type: String,
          trim: true,
          default: null,
        },

        businessType: {
          type: String,
          enum: [
            "Individual Owner",
            "Real Estate Agency",
            "Property Developer",
            "Corporate Entity",
          ],
          default: "Individual Owner",
        },

        registrationNumber: {
          type: String,
          trim: true,
          default: null,
        },

        website: {
          type: String,
          trim: true,
          default: null,
        },

        officeAddress: {
          type: String,
          trim: true,
          default: null,
        },

        paymentMethod: {
          type: String,
          enum: [
            "Bank Transfer (Direct Deposit)",
            "Wire Transfer (International)",
            "Cheque",
          ],
          default: "Bank Transfer (Direct Deposit)",
        },

        payoutFrequency: {
          type: String,
          enum: [
            "Monthly (1st of Month)",
            "Bi-weekly",
            "Immediate (Upon Clearing)",
          ],
          default: "Monthly (1st of Month)",
        },

        taxId: {
          type: String,
          trim: true,
          default: null,
        },

        taxStatus: {
          type: String,
          enum: [
            "Registered Corporate Entity",
            "Sole Proprietor",
            "Non-resident",
          ],
          default: "Sole Proprietor",
        },

        taxResidence: {
          type: String,
          default: "Nigeria",
        },

        profileVisibility: {
          type: String,
          enum: ["Public", "Private", "Hidden"],
          default: "Public",
        },

        dataSharing: {
          type: String,
          enum: ["share", "do_not_share"],
          default: "share",
        },
      },

      // Shared notification preferences.
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },

        sms: {
          type: Boolean,
          default: false,
        },

        push: {
          type: Boolean,
          default: true,
        },

        property: {
          type: Boolean,
          default: true,
        },

        priceDrop: {
          type: Boolean,
          default: true,
        },

        mortgage: {
          type: Boolean,
          default: false,
        },

        marketing: {
          type: Boolean,
          default: false,
        },

        offers: {
          type: Boolean,
          default: true,
        },

        viewingRequests: {
          type: Boolean,
          default: true,
        },

        messages: {
          type: Boolean,
          default: true,
        },

        operationalAlerts: {
          type: Boolean,
          default: true,
        },

        approvalRequests: {
          type: Boolean,
          default: true,
        },

        performanceUpdates: {
          type: Boolean,
          default: true,
        },
      },

      // Shared regional display preferences.
      regional: {
        theme: {
          type: String,
          enum: ["dark", "light", "system"],
          default: "dark",
        },

        language: {
          type: String,
          enum: ["en-GB", "en-US", "fr"],
          default: "en-GB",
        },

        timeZone: {
          type: String,
          default: "Africa/Lagos",
        },

        currency: {
          type: String,
          enum: ["NGN", "USD", "GBP", "EUR"],
          default: "NGN",
        },
      },
    },
  },
  { timestamps: true },
);

// Continue hashing passwords whenever a password changes.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare a submitted password with its stored hash.
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
