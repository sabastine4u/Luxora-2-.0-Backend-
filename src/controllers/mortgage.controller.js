// Import the Mortgage service functions used by the controller.
const {
  createMortgageApplication,
  getMortgageApplicationsByBuyer,
} = require("../services/mortgage.service");

// Import the Joi schema used to validate Mortgage Application requests.
const {
  createMortgageApplicationSchema,
} = require("../validators/mortgage.validator");

// Create a Mortgage Application for the authenticated Buyer.
const createMortgageApplicationController = async (req, res, next) => {
  try {
    // Validate and normalize the incoming request body.
    const { error, value } = createMortgageApplicationSchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      },
    );

    // Pass validation errors to the centralized error handler.
    if (error) {
      return next(error);
    }

    // Get the authenticated user's ID from the authentication middleware.
    const buyerId = req.user._id || req.user.id;

    // Create the Mortgage Application through the service layer.
    const application = await createMortgageApplication(
      buyerId,
      value,
    );

    // Return the newly created application.
    return res.status(201).json({
      success: true,
      message: "Mortgage application submitted successfully.",
      application,
    });
  } catch (error) {
    // Pass service or database errors to the centralized error handler.
    return next(error);
  }
};

// Retrieve all Mortgage Applications belonging to the authenticated Buyer.
const getMyMortgageApplicationsController = async (req, res, next) => {
  try {
    // Get the authenticated user's ID from the authentication middleware.
    const buyerId = req.user._id || req.user.id;

    // Retrieve the Buyer's mortgage applications through the service layer.
    const applications = await getMortgageApplicationsByBuyer(buyerId);

    // Return the applications to the Buyer Dashboard.
    return res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    // Pass service or database errors to the centralized error handler.
    return next(error);
  }
};

// Export the Mortgage controller functions for the routes.
module.exports = {
  createMortgageApplicationController,
  getMyMortgageApplicationsController,
};