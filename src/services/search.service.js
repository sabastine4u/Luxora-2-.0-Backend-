// Import the Property model so the search service can query published Properties.
const Property = require("../models/property.model");

// Escape regular-expression metacharacters before creating a user-supplied search pattern.
const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build the MongoDB filter used by the public Property search.
const buildPropertySearchFilter = (query) => {
  // Start with the public marketplace rule so Draft and internal Properties remain hidden.
  const filter = {
    status: "Published",
  };

  // Store free-text search conditions separately so multiple text searches
  // can be combined without one condition overwriting another.
  const textSearchConditions = [];

  // Search the Property title and geographic fields when a general search is supplied.
  if (query.search) {
    // Escape user input before creating the regular-expression search pattern.
    const searchPattern = new RegExp(
      escapeRegExp(query.search.trim()),
      "i",
    );

    // Add the general text-search condition.
    textSearchConditions.push({
      $or: [
        { title: searchPattern },
        { state: searchPattern },
        { city: searchPattern },
        { area: searchPattern },
        { estateName: searchPattern },
      ],
    });
  }

  // Search the geographic fields when a dedicated location search is supplied.
  if (query.location) {
    // Escape user input before creating the regular-expression search pattern.
    const locationPattern = new RegExp(
      escapeRegExp(query.location.trim()),
      "i",
    );

    // Add the location-specific search condition.
    textSearchConditions.push({
      $or: [
        { state: locationPattern },
        { city: locationPattern },
        { area: locationPattern },
        { estateName: locationPattern },
      ],
    });
  }

  // Require every supplied text-search condition to match.
  if (textSearchConditions.length > 0) {
    filter.$and = textSearchConditions;
  }

  // Normalize the Property type before using it in the exact-match query.
  if (query.propertyType) {
    filter.propertyTypeNormalized =
      query.propertyType.trim().toLowerCase();
  }

  // Normalize the transaction type before applying the exact-match filter.
  if (query.transactionType) {
    filter.transactionType =
      query.transactionType.trim().toLowerCase();
  }

  // Normalize the state before using it in the exact-match query.
  if (query.state) {
    filter.stateNormalized =
      query.state.trim().toLowerCase();
  }

  // Normalize the city before using it in the exact-match query.
  if (query.city) {
    filter.cityNormalized =
      query.city.trim().toLowerCase();
  }

  // Filter published Properties by Agency.
if (query.agencyId) {
  filter.agency = query.agencyId;
}

// Filter published Properties by Agent.
if (query.agentId) {
  filter.agent = query.agentId;
}

  // Apply a minimum price boundary when the client supplied one.
  if (query.minPrice !== undefined) {
    filter.price = {
      ...filter.price,
      $gte: query.minPrice,
    };
  }

  // Apply a maximum price boundary when the client supplied one.
  if (query.maxPrice !== undefined) {
    filter.price = {
      ...filter.price,
      $lte: query.maxPrice,
    };
  }

  // Filter by minimum bedrooms when the client supplied the filter.
  if (query.bedrooms !== undefined) {
    filter.bedrooms = {
      $gte: query.bedrooms,
    };
  }

  // Filter by minimum bathrooms when the client supplied the filter.
  if (query.bathrooms !== undefined) {
    filter.bathrooms = {
      $gte: query.bathrooms,
    };
  }

  // Filter by furnishing state using the Property model's fixed enum values.
  if (query.furnishing) {
    filter.furnishing = query.furnishing;
  }

  // Filter by the current public availability state.
  if (query.availabilityStatus) {
    filter.availabilityStatus = query.availabilityStatus;
  }

  // Filter by the Property verification level.
  if (query.verificationLevel) {
    filter.verificationLevel = query.verificationLevel;
  }

  // Filter by the marketplace listing tier.
  if (query.listingTier) {
    filter.listingTier = query.listingTier;
  }

  // Filter Properties based on mortgage availability.
  if (query.mortgageSupport !== undefined) {
    filter["mortgageOptions.available"] = query.mortgageSupport;
  }

  // Filter Properties that contain every requested amenity.
  if (query.amenities) {
    // Convert either an array or comma-separated string into an array.
    const amenities = Array.isArray(query.amenities)
      ? query.amenities
      : query.amenities
          .split(",")
          .map((amenity) => amenity.trim())
          .filter(Boolean);

    // Require all requested amenities to exist on the Property.
    filter.amenities = {
      $all: amenities,
    };
  }

  // Filter Properties by one or more payment-plan durations.
  if (query.paymentPlan) {
    // Convert either an array or comma-separated string into durations.
    const durations = Array.isArray(query.paymentPlan)
      ? query.paymentPlan
      : query.paymentPlan
          .split(",")
          .map((duration) => Number(duration))
          .filter(Number.isFinite);

    // Match Properties that contain at least one requested payment-plan duration.
    filter["paymentPlans.durationMonths"] = {
      $in: durations,
    };
  }

  // Filter by the minimum physical Property size.
  if (query.minArea !== undefined) {
    filter.propertySize = {
      ...filter.propertySize,
      $gte: query.minArea,
    };
  }

  // Filter by the maximum physical Property size.
  if (query.maxArea !== undefined) {
    filter.propertySize = {
      ...filter.propertySize,
      $lte: query.maxArea,
    };
  }

  // Return the completed MongoDB filter to the search service.
  return filter;
};

// Search the public Property marketplace using validated query parameters.
const searchProperties = async (query = {}) => {
  // Build the MongoDB filter from the validated search parameters.
  const filter = buildPropertySearchFilter(query);

  // Use the validated page number supplied by the search validator.
  const page = query.page;

  // Use the validated page size supplied by the search validator.
  const limit = query.limit;

  // Calculate how many documents MongoDB should skip for the requested page.
  const skip = (page - 1) * limit;

  // Default to newest Properties first.
  let sort = {
    createdAt: -1,
  };

  // Sort from lowest price to highest price when requested.
  if (query.sort === "price-asc") {
    sort = {
      price: 1,
    };
  }

  // Sort from highest price to lowest price when requested.
  if (query.sort === "price-desc") {
    sort = {
      price: -1,
    };
  }

  // Count the total number of matching published Properties.
  const total = await Property.countDocuments(filter);

  // Retrieve only the requested page of matching Properties.
  const properties = await Property.find(filter)
    // Populate the Agent relationship and include public User information.
    .populate({
      path: "agent",
      select: "user agency",
      populate: {
        // Populate the User account linked to the Agent profile.
        path: "user",
        select: "fullName email",
      },
    })
    // Populate the Agency relationship required by the marketplace.
    .populate({
      path: "agency",
      select: "name",
    })
    // Apply the requested sorting order.
    .sort(sort)
    // Skip Properties belonging to earlier pages.
    .skip(skip)
    // Return only the requested number of Properties.
    .limit(limit);

  // Calculate the total number of available result pages.
  const totalPages = Math.ceil(total / limit);

  // Return the Properties and pagination information to the service layer.
  return {
    properties,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

// Export the Property search functions for use by the Property service.
module.exports = {
  buildPropertySearchFilter,
  searchProperties,
};