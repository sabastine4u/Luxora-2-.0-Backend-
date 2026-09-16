// Import the Property validation schema used to validate incoming request data.
const { createPropertySchema } = require("../validators/property.validator");

// Import the Property service responsible for Property business logic.
const propertyService = require("../services/property.service");

// Import the centralized API response helper used throughout the backend.
const api = require("../utils/api-response");

// Import the application error class used for controlled validation errors.
const AppError = require("../utils/AppError");

// Import the Property search validation schema used for marketplace queries.
const {
  searchPropertiesSchema,
} = require("../validators/property-search.validator");

// Create a new Property from the authenticated user's request.
exports.createProperty = async (req, res, next) => {
  try {
    // Validate and normalize the incoming Property payload before it reaches the service.
    const { error, value } = createPropertySchema.validate(req.body, {
      // Return all validation errors instead of stopping at the first one.
      abortEarly: false,

      // Remove fields that are not defined in the Property validation schema.
      stripUnknown: true,

      // Convert compatible values such as numeric strings into their expected types.
      convert: true,
    });

    // Stop the request when the submitted Property data fails validation.
    if (error) {
      // Collect all Joi validation messages into one readable API error.
      const message = error.details
        .map((detail) => detail.message)
        .join(", ");

      // Pass the validation failure to the centralized error handler.
      return next(new AppError(message, 400));
    }

    // Delegate creation and authorization-related business logic to the Property service.
    const property = await propertyService.createProperty(
      value,
      req.user,
    );

    // Return the newly created Property to the authenticated client.
    return api.created(
      res,
      { property },
      "Property created successfully",
    );
  } catch (error) {
    // Pass unexpected or service-level errors to the global error handler.
    next(error);
  }
};

// Retrieve Properties that are publicly available on the Luxora marketplace.
exports.getProperties = async (req, res, next) => {
  try {
    // Validate the incoming search/filter query parameters before they reach the service.
    const { error, value } = searchPropertiesSchema.validate(
      req.query,
      {
        // Return all validation errors instead of stopping at the first one.
        abortEarly: false,

        // Remove query parameters that aren't part of the search schema.
        stripUnknown: true,

        // Convert compatible values such as numeric strings into their expected types.
        convert: true,
      },
    );

    // Stop the request when the submitted search query fails validation.
    if (error) {
      // Collect all Joi validation messages into one readable API error.
      const message = error.details
        .map((detail) => detail.message)
        .join(", ");

      // Pass the validation failure to the centralized error handler.
      return next(new AppError(message, 400));
    }

    // Pass the validated and normalized query parameters to the Property service.
    const result = await propertyService.getProperties(value);

    // Return the Properties together with pagination metadata.
    return api.success(
      res,
      result,
      "Properties retrieved successfully",
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Retrieve all Properties belonging to the authenticated Owner.
exports.getOwnerProperties = async (req, res, next) => {
  try {
    // Ask the Property service for the authenticated Owner's Properties.
    const properties = await propertyService.getOwnerProperties(
      req.user,
    );

    // Return the Owner's Property Requests using the standard API response format.
    return api.success(
      res,
      { properties },
      "Owner properties retrieved successfully",
    );
  } catch (error) {
    // Pass unexpected or service-level errors to the global error handler.
    next(error);
  }
};

// Retrieve one published Property from the public Luxora marketplace.
exports.getPropertyById = async (req, res, next) => {
  try {
    // Ask the Property service for a publicly visible Property by ID.
    const property = await propertyService.getPropertyById(
      req.params.id,
    );

    // Treat missing or unpublished Properties as unavailable to the public.
    if (!property) {
      return next(
        new AppError("Property not found", 404),
      );
    }

    // Return the requested public Property using the standard API response format.
    return api.success(
      res,
      { property },
      "Property retrieved successfully",
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Record a public Property detail-page view for analytics.
exports.recordPropertyView = async (req, res, next) => {
  try {
    // Read the anonymous visitor identifier sent by the browser.
    const { visitorId } = req.body;

    // Record the view through the Property service.
    const result = await propertyService.recordPropertyView(
      req.params.id,
      visitorId,
    );

    // Return whether a new view event was created.
    return api.success(
      res,
      result,
      result.recorded
        ? "Property view recorded successfully"
        : "Recent property view already recorded",
    );
  } catch (error) {
    // Pass controlled and unexpected errors to the centralized error handler.
    next(error);
  }
};

// Assign a Property to an Agency.
exports.assignPropertyToAgency = async (req, res, next) => {
  try {
    // Extract the Property and Agency IDs from the request.
    const { propertyId } = req.params;
    const { agencyId } = req.body;

    // Ensure an Agency ID was provided in the request body.
    if (!agencyId) {
      return next(
        new AppError(
          "Agency ID is required",
          400,
        ),
      );
    }

    // Delegate the Agency assignment and authorization rules to the Property service.
    const property =
      await propertyService.assignPropertyToAgency(
        propertyId,
        agencyId,
        req.user,
      );

    // Return the updated Property after the Agency assignment succeeds.
    return api.success(
      res,
      { property },
      "Property assigned to agency successfully",
    );
  } catch (error) {
    // Pass unexpected or service-level errors to the global error handler.
    next(error);
  }
};

// Assign or reassign a Property to an Agent.
exports.assignPropertyToAgent = async (req, res, next) => {
  try {
    // Extract the Property and Agent IDs from the request.
    const { propertyId } = req.params;
    const { agentId } = req.body;

    // Ensure an Agent ID was provided in the request body.
    if (!agentId) {
      return next(
        new AppError(
          "Agent ID is required",
          400,
        ),
      );
    }

    // Delegate the Agent assignment and authorization rules to the Property service.
    const property =
      await propertyService.assignPropertyToAgent(
        propertyId,
        agentId,
        req.user,
      );

    // Return the updated Property after the Agent assignment succeeds.
    return api.success(
      res,
      { property },
      "Property assigned to agent successfully",
    );
  } catch (error) {
    // Pass unexpected or service-level errors to the global error handler.
    next(error);
  }
};

// Retrieve all Properties assigned to the authenticated Agency.
exports.getAgencyProperties = async (req, res, next) => {
  try {
    // Ask the Property service for this Agency's assigned Properties.
    const properties =
      await propertyService.getAgencyProperties(req.user);

    // Return the Agency's Property collection using the standard API response.
    return api.success(
      res,
      { properties },
      "Agency properties retrieved successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Update a Property belonging to the authenticated Agency.
exports.updateAgencyProperty = async (req, res, next) => {
  try {
    // Delegate the Agency Property update to the service layer.
    const property =
      await propertyService.updateAgencyProperty(
        req.params.propertyId,
        req.body,
        req.user,
      );

    // Return the updated Property using the standard API response format.
    return api.success(
      res,
      { property },
      "Agency property updated successfully",
    );
  } catch (error) {
    // Forward service and unexpected errors to the global error handler.
    next(error);
  }
};

// Retrieve real view analytics for Properties belonging to the authenticated Agency.
exports.getAgencyPropertyAnalytics = async (
  req,
  res,
  next,
) => {
  try {
    // Ask the Property service for real PropertyView totals.
    const analytics =
      await propertyService.getAgencyPropertyAnalytics(
        req.user,
      );

    // Return the real analytics collection.
    return api.success(
      res,
      { analytics },
      "Agency property analytics retrieved successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Retrieve Properties currently waiting for the authenticated Agent's response.
exports.getAgentProperties = async (req, res, next) => {
  try {
    // Ask the Property service for assignments belonging to this Agent.
    const properties =
      await propertyService.getAgentProperties(req.user);

    // Return the Agent's pending assignment queue.
    return api.success(
      res,
      { properties },
      "Agent property assignments retrieved successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Retrieve Properties that the authenticated Agent has accepted for active management.
exports.getAgentListings = async (req, res, next) => {
  try {
    // Ask the Property service for the Agent's accepted Listings.
    const properties = await propertyService.getAgentListings(
      req.user,
    );

    // Return the accepted Listings using the standard API response format.
    return api.success(
      res,
      { properties },
      "Agent listings retrieved successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Accept a Property assignment for the authenticated Agent.
exports.acceptPropertyAssignment = async (
  req,
  res,
  next,
) => {
  try {
    // Read the Property ID from the route parameter.
    const { propertyId } = req.params;

    // Delegate the acceptance workflow to the Property service.
    const property =
      await propertyService.acceptPropertyAssignment(
        propertyId,
        req.user,
      );

    // Return the updated Property after successful acceptance.
    return api.success(
      res,
      { property },
      "Property assignment accepted successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Decline a Property assignment for the authenticated Agent.
exports.declinePropertyAssignment = async (
  req,
  res,
  next,
) => {
  try {
    // Read the Property ID from the route parameter.
    const { propertyId } = req.params;

    // Read the Agent's decline reason from the request body.
    const { reason } = req.body;

    // Delegate the decline workflow and validation to the Property service.
    const property =
      await propertyService.declinePropertyAssignment(
        propertyId,
        reason,
        req.user,
      );

    // Return the updated Property after successful decline.
    return api.success(
      res,
      { property },
      "Property assignment declined successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Assign or reassign the Property Manager responsible for a Property.
exports.assignPropertyToManager = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { propertyManagerId } = req.body;

    if (!propertyManagerId) {
      return next(new AppError("Property Manager ID is required", 400));
    }

    const property = await propertyService.assignPropertyToManager(
      propertyId,
      propertyManagerId,
      req.user,
    );

    return api.success(
      res,
      { property },
      "Property manager assigned successfully",
    );
  } catch (error) {
    return next(error);
  }
};
