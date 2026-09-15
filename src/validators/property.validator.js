// Import Joi so we can validate incoming Property request payloads.
const Joi = require('joi');

// Define the validation schema for creating a Property.
const createPropertySchema = Joi.object({
  // Validate the public Property title.
  title: Joi.string()
    .trim()
    .max(150)
    .required(),

  // Validate the public Property description.
  description: Joi.string()
    .trim()
    .max(5000)
    .required(),

  // Validate the main Luxora Property category.
  propertyType: Joi.string()
    .trim()
    .required(),

  // Validate the optional Property subtype.
  propertySubType: Joi.string()
    .trim()
    .allow('', null),

  // Validate the transaction type supported by Luxora.
  transactionType: Joi.string()
    .valid('buy', 'rent', 'lease')
    .required(),

  // Validate the country where the Property is located.
  country: Joi.string()
    .trim()
    .default('Nigeria'),

  // Validate the required Property state.
  state: Joi.string()
    .trim()
    .required(),

  // Validate the required Property city.
  city: Joi.string()
    .trim()
    .required(),

  // Validate the broader locality or area of the Property.
  area: Joi.string()
    .trim()
    .allow('', null),

  // Validate the full Property address when available.
  address: Joi.string()
    .trim()
    .allow('', null),

  // Validate the estate or named development when applicable.
  estateName: Joi.string()
    .trim()
    .allow('', null),

  // Validate an optional nearby landmark.
  landmark: Joi.string()
    .trim()
    .allow('', null),

  // Allow the creator to hide the exact address from public users.
  hideExactAddress: Joi.boolean()
    .default(false),

  // Validate the geographic coordinates used by Luxora maps.
  coordinates: Joi.object({
    // Validate latitude within the valid geographic range.
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .allow(null),

    // Validate longitude within the valid geographic range.
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .allow(null),
  }).allow(null),

  // Validate the number of bedrooms.
  bedrooms: Joi.number()
    .integer()
    .min(0)
    .default(0),

  // Validate the number of bathrooms.
  bathrooms: Joi.number()
    .min(0)
    .default(0),

  // Validate the number of toilets.
  toilets: Joi.number()
    .min(0)
    .default(0),

  // Validate the number of dedicated parking spaces.
  parkingSpaces: Joi.number()
    .integer()
    .min(0)
    .default(0),

  // Validate the physical size of the Property.
  propertySize: Joi.number()
    .min(0)
    .allow(null),

  // Validate the unit used for the Property size.
  propertySizeUnit: Joi.string()
    .valid('sqm', 'sqft', 'acres', 'plots')
    .default('sqm'),

  // Validate the year the Property was built.
  yearBuilt: Joi.number()
    .integer()
    .min(1800)
    .max(new Date().getFullYear())
    .allow(null),

  // Validate the floor number when applicable.
  floorNumber: Joi.number()
    .integer()
    .min(0)
    .allow(null),

  // Validate the total number of floors in the building.
  totalFloors: Joi.number()
    .integer()
    .min(1)
    .allow(null),

  // Validate the property's furnishing state.
  furnishing: Joi.string()
    .valid(
      'Unfurnished',
      'Semi-Furnished',
      'Fully Furnished'
    )
    .allow(null),

  // Validate the current physical or development condition.
  propertyCondition: Joi.string()
    .valid(
      'newly_built',
      'renovated',
      'fairly_used',
      'off_plan',
      'under_construction'
    )
    .allow(null),

  // Validate the list of Property amenities.
  amenities: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  // Validate the main advertised Property price.
  price: Joi.number()
    .min(0)
    .allow(null),

  // Validate the currency used for the Property price.
  currency: Joi.string()
    .trim()
    .uppercase()
    .default('NGN'),

  // Validate the pricing condition shown to customers.
  priceType: Joi.string()
    .valid(
      'fixed',
      'negotiable',
      'price_on_request',
      'auction'
    )
    .default('fixed'),

  // Validate the period or unit represented by the price.
  priceFrequency: Joi.string()
    .valid(
      'total',
      'monthly',
      'yearly',
      'perNight',
      'perPlot',
      'perAcre'
    )
    .default('total'),

  // Validate whether the creator is willing to negotiate the price.
  isNegotiable: Joi.boolean()
    .default(false),

  // Validate a transaction-specific rental amount when applicable.
  rentAmount: Joi.number()
    .min(0)
    .allow(null),

  // Validate recurring service or maintenance charges.
  serviceCharge: Joi.number()
    .min(0)
    .allow(null),

  // Validate the agency fee.
  agencyFee: Joi.number()
    .min(0)
    .allow(null),

  // Validate legal or documentation fees.
  legalFee: Joi.number()
    .min(0)
    .allow(null),

  // Validate the caution or security deposit.
  cautionDeposit: Joi.number()
    .min(0)
    .allow(null),

  // Validate any additional charge not covered by the standard fee fields.
  otherCharges: Joi.number()
    .min(0)
    .allow(null),

  // Validate the advertised lease duration when supplied.
  leaseDuration: Joi.string()
    .trim()
    .allow('', null),

  // Validate the marketplace listing tier.
  listingTier: Joi.string()
    .valid('Basic', 'Plus', 'Pro')
    .default('Basic'),

  // Validate the promotional visibility level.
  featuredLevel: Joi.string()
    .valid('Standard', 'Premium', 'Exclusive')
    .default('Standard'),

  // Validate the installment payment plans supplied by the creator.
  paymentPlans: Joi.array()
    .items(
      Joi.object({
        // Validate the plan duration in months.
        durationMonths: Joi.number()
          .integer()
          .min(1)
          .required(),

        // Validate the amount paid during each installment.
        installmentAmount: Joi.number()
          .min(0)
          .required(),

        // Validate the installment frequency.
        frequency: Joi.string()
          .valid('monthly', 'quarterly', 'yearly')
          .default('monthly'),

        // Validate an optional payment-plan description.
        description: Joi.string()
          .trim()
          .allow('', null),
      })
    )
    .default([]),

  // Validate mortgage information supplied for the Property.
  mortgageOptions: Joi.object({
    // Define whether mortgage financing is available.
    available: Joi.boolean()
      .default(false),

    // Validate the mortgage providers associated with the Property.
    providers: Joi.array()
      .items(Joi.string().trim())
      .default([]),

    // Validate the minimum required down-payment percentage.
    minimumDownPaymentPercent: Joi.number()
      .min(0)
      .max(100)
      .allow(null),

    // Validate the maximum mortgage term.
    maximumTermYears: Joi.number()
      .integer()
      .min(1)
      .allow(null),

    // Validate an optional mortgage note.
    notes: Joi.string()
      .trim()
      .allow('', null),
  }).default({
    available: false,
    providers: [],
  }),

  // Validate the uploaded image references once the upload service has created URLs.
  images: Joi.array()
    .items(Joi.string().trim().uri())
    .default([]),

  // Validate the primary Property cover image URL.
  coverImage: Joi.string()
    .trim()
    .uri()
    .allow('', null),

  // Validate an optional Property video URL.
  videoUrl: Joi.string()
    .trim()
    .uri()
    .allow('', null),

  // Validate an optional virtual-tour URL.
  virtualTourUrl: Joi.string()
    .trim()
    .uri()
    .allow('', null),

  // Validate an optional brochure URL.
  brochureUrl: Joi.string()
    .trim()
    .uri()
    .allow('', null),

  // Validate floor-plan image or document URLs.
  floorPlans: Joi.array()
    .items(Joi.string().trim().uri())
    .default([]),

  // Validate uploaded Property document references.
  documents: Joi.array()
    .items(
      Joi.object({
        // Store the document's display name.
        title: Joi.string()
          .trim()
          .required(),

        // Store the document's uploaded URL.
        url: Joi.string()
          .trim()
          .uri()
          .required(),

        // Track whether the document has been verified.
        verified: Joi.boolean()
          .default(false),

        // Store the upload timestamp when provided.
        uploadedAt: Joi.date()
          .iso()
          .allow(null),
      })
    )
    .default([]),

  // Validate the business source of the Property.
  listingSource: Joi.string()
    .valid(
      'Assigned Property',
      'Private Owner',
      'Agency Portfolio',
      'Developer Project',
      'Bank Property',
      'Corporate Property',
      'Government Property'
    )
    .default('Private Owner'),

  // Validate the associated Owner User ID when supplied.
  owner: Joi.string()
    .hex()
    .length(24)
    .allow('', null),

  // Validate the associated Agent document ID when supplied.
  agent: Joi.string()
    .hex()
    .length(24)
    .allow('', null),

  // Validate the associated Agency document ID when supplied.
  agency: Joi.string()
    .hex()
    .length(24)
    .allow('', null),

  // Validate the current Property verification level.
  verificationLevel: Joi.string()
    .valid(
      'Unverified',
      'Agent Reviewed',
      'Documents Verified',
      'Physical Inspection Completed'
    )
    .default('Unverified'),

  // Validate the current physical inspection state.
  inspectionStatus: Joi.string()
    .valid(
      'Not Scheduled',
      'Scheduled',
      'In Progress',
      'Completed',
      'Failed'
    )
    .default('Not Scheduled'),

  // Validate the completed inspection timestamp when supplied.
  inspectionCompletedAt: Joi.date()
    .iso()
    .allow(null),

  // Validate the User ID of the person who completed the inspection.
  inspectedBy: Joi.string()
    .hex()
    .length(24)
    .allow('', null),

  // Validate the current Property lifecycle state.
  status: Joi.string()
    .valid(
      'Draft',
      'Pending Review',
      'Approved',
      'Published',
      'Under Offer',
      'Sold',
      'Rented',
      'Leased',
      'Archived'
    )
    .default('Draft'),

  // Validate the date on which the Property is expected to become available.
  availabilityDate: Joi.date()
    .iso()
    .allow(null),

  // Validate the current availability state.
  availabilityStatus: Joi.string()
    .valid(
      'Available',
      'Unavailable',
      'Coming Soon'
    )
    .default('Available'),
})
// Apply business rules that depend on more than one Property field.
.custom((property, helpers) => {
  // Require a concrete price for fixed-price listings.
  if (
    property.priceType === 'fixed' &&
    property.price === null
  ) {
    return helpers.message({
      custom: 'Price is required when price type is fixed',
    });
  }

  // Require a concrete price for negotiable listings.
  if (
    property.priceType === 'negotiable' &&
    property.price === null
  ) {
    return helpers.message({
      custom: 'Price is required when price type is negotiable',
    });
  }

  // Require the negotiation flag when the pricing type is negotiable.
  if (
    property.priceType === 'negotiable' &&
    property.isNegotiable !== true
  ) {
    return helpers.message({
      custom: 'Negotiable listings must have isNegotiable set to true',
    });
  }

  // Prevent fixed listings from being marked as negotiable.
  if (
    property.priceType === 'fixed' &&
    property.isNegotiable === true
  ) {
    return helpers.message({
      custom: 'Fixed listings cannot have isNegotiable set to true',
    });
  }

  // Require a lease duration when the transaction type is lease.
  if (
    property.transactionType === 'lease' &&
    !property.leaseDuration
  ) {
    return helpers.message({
      custom: 'Lease duration is required for lease properties',
    });
  }

  // Require an availability date for properties marked as coming soon.
  if (
    property.availabilityStatus === 'Coming Soon' &&
    !property.availabilityDate
  ) {
    return helpers.message({
      custom: 'Availability date is required for coming soon properties',
    });
  }

  // Require an inspection completion date when inspection is completed.
  if (
    property.inspectionStatus === 'Completed' &&
    !property.inspectionCompletedAt
  ) {
    return helpers.message({
      custom: 'Inspection completion date is required when inspection is completed',
    });
  }

  // Return the validated Property payload when all business rules pass.
  return property;
});

// Define the roles that are allowed to create Property records.
const PROPERTY_CREATOR_ROLES = [
  'Owner',
  'Agent',
  'Admin',
  'Super Admin',
];

// Validate whether the authenticated user is allowed to create a Property.
const validatePropertyCreatorRole = (userRole) => {
  // Reject missing roles because every Property creation request must come from an authenticated role.
  if (!userRole) {
    return {
      valid: false,
      message: 'Authenticated user role is required to create a property',
    };
  }

  // Check whether the authenticated role is one of the approved Property creator roles.
  if (!PROPERTY_CREATOR_ROLES.includes(userRole)) {
    return {
      valid: false,
      message: 'You do not have permission to create a property',
    };
  }

  // Confirm that the authenticated role is allowed to create the Property.
  return {
    valid: true,
    message: null,
  };
};

// Export the Property validation schema and creator authorization helper.
module.exports = {
  createPropertySchema,
  validatePropertyCreatorRole,
};