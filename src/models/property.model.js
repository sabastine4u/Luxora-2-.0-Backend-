// Import Mongoose so we can define the Property schema and model.
const mongoose = require("mongoose");
const { PROPERTY_TYPES } = require("../config/constants");

// Define the Property schema used as the source of truth for Luxora properties.
const propertySchema = new mongoose.Schema(
  {
    // Store the public title displayed for the property.
    title: {
      type: String,
      required: [true, "Property title is required"],
      trim: true,
      maxlength: [150, "Property title cannot exceed 150 characters"],
    },

    // Store the detailed property description shown on the property details page.
    description: {
      type: String,
      required: [true, "Property description is required"],
      trim: true,
      maxlength: [5000, "Property description cannot exceed 5000 characters"],
    },

    // Define the main Luxora property category.
    propertyType: {
      type: String,
      required: [true, "Property type is required"],
      enum: {
        values: PROPERTY_TYPES,
        message: "Invalid Luxora property type",
      },
      trim: true,
    },

    // Store a lowercase search-friendly version of the Property category.
    propertyTypeNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Store an optional subtype for more specific property classification.
    propertySubType: {
      type: String,
      trim: true,
      default: null,
    },

    // Define the marketplace tier assigned to the property listing.
    listingTier: {
      type: String,
      enum: {
        values: ["Basic", "Plus", "Pro"],
        message: "Invalid listing tier",
      },
      default: "Basic",
    },

    // Define the promotional visibility level assigned to the property.
    featuredLevel: {
      type: String,
      enum: {
        values: ["Standard", "Premium", "Exclusive"],
        message: "Invalid featured level",
      },
      default: "Standard",
    },

    // Define the transaction the property is being offered for.
    transactionType: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: {
        values: ["buy", "rent", "lease"],
        message: "Transaction type must be buy, rent, or lease",
      },
      lowercase: true,
    },

    // Store the country where the property is located.
    country: {
      type: String,
      trim: true,
      default: "Nigeria",
    },

    // Store the state where the property is located.
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },

    // Store a lowercase search-friendly version of the Property state.
    stateNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Store the city where the property is located.
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },

    // Store a lowercase search-friendly version of the Property city.
    cityNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Store the broader locality or area used by Luxora's search system.
    area: {
      type: String,
      trim: true,
      default: null,
    },

    // Store the full property address when it is permitted to be displayed.
    address: {
      type: String,
      trim: true,
      default: null,
    },

    // Store the estate or named residential development when applicable.
    estateName: {
      type: String,
      trim: true,
      default: null,
    },

    // Store a nearby landmark that helps users identify the location.
    landmark: {
      type: String,
      trim: true,
      default: null,
    },

    // Allow the creator to hide the exact address from public users.
    hideExactAddress: {
      type: Boolean,
      default: false,
    },

    // Store geographic coordinates used by Luxora's map and location features.
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, "Latitude cannot be less than -90"],
        max: [90, "Latitude cannot be greater than 90"],
        default: null,
      },

      longitude: {
        type: Number,
        min: [-180, "Longitude cannot be less than -180"],
        max: [180, "Longitude cannot be greater than 180"],
        default: null,
      },
    },

    // Store the number of bedrooms available in the property.
    bedrooms: {
      type: Number,
      min: [0, "Bedrooms cannot be negative"],
      default: 0,
    },

    // Store the number of bathrooms available in the property.
    bathrooms: {
      type: Number,
      min: [0, "Bathrooms cannot be negative"],
      default: 0,
    },

    // Store the number of toilets available in the property.
    toilets: {
      type: Number,
      min: [0, "Toilets cannot be negative"],
      default: 0,
    },

    // Store the number of dedicated parking spaces available.
    parkingSpaces: {
      type: Number,
      min: [0, "Parking spaces cannot be negative"],
      default: 0,
    },

    // Store the property's total physical size.
    propertySize: {
      type: Number,
      min: [0, "Property size cannot be negative"],
      default: null,
    },

    // Store the unit used for the property's physical size.
    propertySizeUnit: {
      type: String,
      enum: {
        values: ["sqm", "sqft", "acres", "plots"],
        message: "Invalid property size unit",
      },
      default: "sqm",
    },

    // Store the year the property was originally built when known.
    yearBuilt: {
      type: Number,
      min: [1800, "Year built is not valid"],
      max: [new Date().getFullYear(), "Year built cannot be in the future"],
      default: null,
    },

    // Store the floor number for multi-level buildings.
    floorNumber: {
      type: Number,
      min: [0, "Floor number cannot be negative"],
      default: null,
    },

    // Store the total number of floors in the building.
    totalFloors: {
      type: Number,
      min: [1, "Total floors must be at least 1"],
      default: null,
    },

    // Store the property's furnishing state.
    furnishing: {
      type: String,
      enum: {
        values: ["Unfurnished", "Semi-Furnished", "Fully Furnished"],
        message: "Invalid furnishing option",
      },
      default: null,
    },

    // Store the current physical or development condition of the property.
    propertyCondition: {
      type: String,
      enum: {
        values: [
          "newly_built",
          "renovated",
          "fairly_used",
          "off_plan",
          "under_construction",
        ],
        message: "Invalid property condition",
      },
      default: null,
    },

    // Store amenities associated with the property.
    amenities: {
      type: [String],
      default: [],
    },

    // Store the main advertised property price.
    price: {
      type: Number,
      min: [0, "Property price cannot be negative"],
      default: null,
    },

    // Store the agreed or advertised lease duration when the property is offered for lease.
    leaseDuration: {
      type: String,
      trim: true,
      default: null,
    },

    // Store the currency used for the property price.
    currency: {
      type: String,
      required: [true, "Currency is required"],
      uppercase: true,
      trim: true,
      default: "NGN",
    },

    // Define the pricing condition presented to the customer.
    priceType: {
      type: String,
      enum: {
        values: ["fixed", "negotiable", "price_on_request", "auction"],
        message: "Invalid price type",
      },
      default: "fixed",
    },

    // Define the period or unit represented by the advertised price.
    priceFrequency: {
      type: String,
      enum: {
        values: [
          "total",
          "monthly",
          "yearly",
          "perNight",
          "perPlot",
          "perAcre",
        ],
        message: "Invalid price frequency",
      },
      default: "total",
    },

    // Store whether the creator is willing to negotiate the advertised price.
    isNegotiable: {
      type: Boolean,
      default: false,
    },

    // Store a dedicated rental amount when transaction-specific rental pricing is required.
    rentAmount: {
      type: Number,
      min: [0, "Rent amount cannot be negative"],
      default: null,
    },

    // Store recurring service or maintenance charges associated with the property.
    serviceCharge: {
      type: Number,
      min: [0, "Service charge cannot be negative"],
      default: null,
    },

    // Store the agency fee associated with the transaction.
    agencyFee: {
      type: Number,
      min: [0, "Agency fee cannot be negative"],
      default: null,
    },

    // Store legal or documentation fees associated with the transaction.
    legalFee: {
      type: Number,
      min: [0, "Legal fee cannot be negative"],
      default: null,
    },

    // Store any caution or security deposit required for the property.
    cautionDeposit: {
      type: Number,
      min: [0, "Caution deposit cannot be negative"],
      default: null,
    },

    // Store any other additional charge that does not fit the standard fee fields.
    otherCharges: {
      type: Number,
      min: [0, "Other charges cannot be negative"],
      default: null,
    },

    // Store installment payment plans offered for the property.
    paymentPlans: [
      {
        // Identify the duration of the installment plan in months.
        durationMonths: {
          type: Number,
          required: true,
          min: [1, "Payment plan duration must be at least 1 month"],
        },

        // Store the amount required for each installment.
        installmentAmount: {
          type: Number,
          required: true,
          min: [0, "Installment amount cannot be negative"],
        },

        // Define how frequently installments are expected.
        frequency: {
          type: String,
          enum: {
            values: ["monthly", "quarterly", "yearly"],
            message: "Invalid payment frequency",
          },
          default: "monthly",
        },

        // Store an optional description for the payment plan.
        description: {
          type: String,
          trim: true,
          default: null,
        },
      },
    ],

    // Store mortgage availability and related information for the property.
    mortgageOptions: {
      // Indicate whether mortgage financing is available.
      available: {
        type: Boolean,
        default: false,
      },

      // Store the institutions or mortgage providers associated with the property.
      providers: {
        type: [String],
        default: [],
      },

      // Store the minimum down-payment percentage when mortgage financing is available.
      minimumDownPaymentPercent: {
        type: Number,
        min: [0, "Minimum down payment cannot be negative"],
        max: [100, "Minimum down payment cannot exceed 100 percent"],
        default: null,
      },

      // Store the maximum mortgage duration in years when known.
      maximumTermYears: {
        type: Number,
        min: [1, "Mortgage term must be at least 1 year"],
        default: null,
      },

      // Store an optional explanatory note about mortgage financing.
      notes: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // Store all property image URLs associated with the listing.
    images: {
      type: [String],
      default: [],
    },

    // Store the URL of the primary or cover image used by Property cards and listings.
    coverImage: {
      type: String,
      trim: true,
      default: null,
    },

    // Store an optional property video URL.
    videoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Store an optional virtual-tour URL.
    virtualTourUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Store an optional property brochure URL.
    brochureUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Store URLs for property floor-plan images or documents.
    floorPlans: {
      type: [String],
      default: [],
    },

    // Store document references associated with the property.
    documents: [
      {
        // Store the document's user-facing name.
        title: {
          type: String,
          required: true,
          trim: true,
        },

        // Store the URL or storage reference for the uploaded document.
        url: {
          type: String,
          required: true,
          trim: true,
        },

        // Track whether Luxora has verified this document.
        verified: {
          type: Boolean,
          default: false,
        },

        // Store the date the document was added.
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Record the business source through which the property information entered the listing workflow.
    listingSource: {
      type: String,
      enum: {
        values: [
          "Assigned Property",
          "Private Owner",
          "Agency Portfolio",
          "Developer Project",
          "Bank Property",
          "Corporate Property",
          "Government Property",
        ],
        message: "Invalid listing source",
      },
      default: "Private Owner",
    },

    // Reference the property owner when an owner is associated with the property.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Reference the dedicated Agent entity responsible for the property listing.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },

    // Reference the Agency associated with the listing when applicable.
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },

    // Reference the User accountable for the property's day-to-day management.
    // This is intentionally independent from the owner, agency, and agent
    // relationships so assigning a Property Manager never changes listing flow.
    propertyManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Track where the property currently sits in Luxora's assignment workflow.
    assignmentStatus: {
      type: String,
      enum: {
        values: [
          "Pending Agency Assignment",
          "Agency Assigned",
          "Agency Declined",
          "Agent Assigned",
          "Agent Accepted",
          "Agent Declined",
        ],
        message: "Invalid property assignment status",
      },
      default: "Pending Agency Assignment",
    },

    // Record the User who performed the latest property assignment action.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Record when the latest property assignment action occurred.
    assignedAt: {
      type: Date,
      default: null,
    },

    // Record the User account of the Agent who responded to the assignment.
    assignmentRespondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Record when the Agent responded to the assignment.
    assignmentRespondedAt: {
      type: Date,
      default: null,
    },

    // Store the Agent's response note or decline reason.
    assignmentResponseNote: {
      type: String,
      trim: true,
      default: null,
    },

    // Record the authenticated User who actually created the property record.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Property creator is required"],
    },

    // Record the role of the User who created the property.
    createdByRole: {
      type: String,
      required: [true, "Creator role is required"],
      enum: {
        values: ["Owner", "Agent", "Admin", "Super Admin"],
        message: "Invalid property creator role",
      },
    },

    // Preserve the business origin of the listing independently from the creator role.
    origin: {
      type: String,
      required: [true, "Property origin is required"],
      enum: {
        values: ["owner", "agent", "admin", "luxora"],
        message: "Invalid property origin",
      },
    },

    // Store the highest verification level currently achieved by the property.
    verificationLevel: {
      type: String,
      enum: {
        values: [
          "Unverified",
          "Agent Reviewed",
          "Documents Verified",
          "Physical Inspection Completed",
        ],
        message: "Invalid property verification level",
      },
      default: "Unverified",
    },

    // Store the current physical inspection state of the property.
    inspectionStatus: {
      type: String,
      enum: {
        values: [
          "Not Scheduled",
          "Scheduled",
          "In Progress",
          "Completed",
          "Failed",
        ],
        message: "Invalid inspection status",
      },
      default: "Not Scheduled",
    },

    // Store the date on which the physical inspection was completed.
    inspectionCompletedAt: {
      type: Date,
      default: null,
    },

    // Store the User who completed the most recent property inspection.
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Store the current lifecycle state of the property listing.
    status: {
      type: String,
      enum: {
        values: [
          "Draft",
          "Pending Review",
          "Approved",
          "Published",
          "Under Offer",
          "Sold",
          "Rented",
          "Leased",
          "Archived",
        ],
        message: "Invalid property status",
      },
      default: "Draft",
    },

    // Record when an Owner withdraws a Property submission.
withdrawnAt: {
  type: Date,
  default: null,
},

// Record which authenticated User withdrew the Property submission.
withdrawnBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

    // Store the date on which the property is expected to become available.
    availabilityDate: {
      type: Date,
      default: null,
    },

    // Store the current availability state of the property.
    availabilityStatus: {
      type: String,
      enum: {
        values: ["Available", "Unavailable", "Coming Soon"],
        message: "Invalid availability status",
      },
      default: "Available",
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps.
    timestamps: true,
  },
);

// Index normalized Property search fields for efficient exact-match marketplace filtering.
propertySchema.index({
  propertyTypeNormalized: 1,
  transactionType: 1,
  stateNormalized: 1,
  cityNormalized: 1,
});

// Index the lifecycle status for marketplace and management queries.
propertySchema.index({
  status: 1,
});

// Index the availability state for marketplace availability queries.
propertySchema.index({
  availabilityStatus: 1,
});

// Index the creator relationship for dashboard and audit queries.
propertySchema.index({
  createdBy: 1,
});

// Index the Agent relationship for Agent and Agency property queries.
propertySchema.index({
  agent: 1,
});

// Index the Agency relationship for Agency-level property queries.
propertySchema.index({
  agency: 1,
});

// Index the portfolio lookup used by the Property Manager dashboard.
propertySchema.index({
  propertyManager: 1,
  createdAt: -1,
});

// Index assignment state for Agency and Agent assignment queues.
propertySchema.index({
  assignmentStatus: 1,
});

// Index verification state for verification and moderation workflows.
propertySchema.index({
  verificationLevel: 1,
});

// Index creation date so newest properties can be retrieved efficiently.
propertySchema.index({
  createdAt: -1,
});

// Export the Property model so controllers and services can use it.
module.exports = mongoose.model("Property", propertySchema);
