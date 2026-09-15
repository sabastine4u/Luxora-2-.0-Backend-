 // Import Joi so we can validate incoming Property search query parameters.
const Joi = require('joi');

// Define the validation schema for the public Property search endpoint.
const searchPropertiesSchema = Joi.object({

    // Validate the free-text marketplace search query.
  search: Joi.string()
    .trim()
    .max(150),
    
  // Validate the Property category filter.
  propertyType: Joi.string()
    .trim()
    .max(100),

  // Validate the supported Property transaction types.
  transactionType: Joi.string()
    .trim()
    .lowercase()
    .valid('buy', 'rent', 'lease'),

  // Validate the state filter.
  state: Joi.string()
    .trim()
    .max(100),

  // Validate the city filter.
  city: Joi.string()
    .trim()
    .max(100),

  // Validate the free-text location search.
  location: Joi.string()
    .trim()
    .max(150),

  // Validate the minimum price boundary.
  minPrice: Joi.number()
    .min(0),

  // Validate the maximum price boundary and ensure it is not below minPrice.
  maxPrice: Joi.number()
    .min(0)
    .min(Joi.ref('minPrice')),

  // Validate the minimum number of bedrooms requested.
  bedrooms: Joi.number()
    .integer()
    .min(0),

  // Validate the minimum number of bathrooms requested.
  bathrooms: Joi.number()
    .integer()
    .min(0),

  // Validate the property's furnishing state.
  furnishing: Joi.string()
    .valid(
      'Unfurnished',
      'Semi-Furnished',
      'Fully Furnished',
    ),

  // Validate the property's public availability state.
  availabilityStatus: Joi.string()
    .valid(
      'Available',
      'Unavailable',
      'Coming Soon',
    ),

  // Validate the property's verification level.
  verificationLevel: Joi.string()
    .valid(
      'Unverified',
      'Agent Reviewed',
      'Documents Verified',
      'Physical Inspection Completed',
    ),

  // Validate the requested result sorting mode.
  sort: Joi.string()
    .valid(
      'newest',
      'price-asc',
      'price-desc',
    )
    .default('newest'),

  // Validate the requested result page number.
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  // Validate the number of Properties returned per page.
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(12),

      // Validate the marketplace listing tier filter.
  listingTier: Joi.string()
    .valid(
      'Basic',
      'Plus',
      'Pro',
    ),

  // Validate whether mortgage support is required.
  mortgageSupport: Joi.boolean(),

  // Validate amenities that every matching Property must contain.
  amenities: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(100)),
    Joi.string().trim().max(100),
  ),

  // Validate payment-plan durations requested by the frontend.
  paymentPlan: Joi.alternatives().try(
    Joi.array().items(
      Joi.number().integer().min(1),
    ),
    Joi.string().pattern(/^\d+(,\d+)*$/),
  ),

  // Validate the minimum Property size in square metres.
  minArea: Joi.number()
    .min(0),

  // Validate the maximum Property size in square metres.
  maxArea: Joi.number()
    .min(0)
    .min(Joi.ref('minArea')),
});

// Export the Property search validation schema for use by the controller.
module.exports = {
  searchPropertiesSchema,
};