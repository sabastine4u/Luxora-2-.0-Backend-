// Import the Deal service so the controller can use the Deal business logic.
const dealService = require("../services/deal.service");

// Get all Deals visible to the authenticated user.
const getMyDeals = async (req, res, next) => {
  try {
    // The service determines which Deals this user is allowed to see
    // based on their role and business relationship to the Deal.
    const deals = await dealService.getMyDeals(req.user);

    // Return the Deals using the same response structure used
    // throughout the Luxora API.
    return res.status(200).json({
      status: "success",
      results: deals.length,
      data: {
        deals,
      },
    });
  } catch (error) {
    // Pass expected and unexpected errors to the centralized handler.
    return next(error);
  }
};

// Get one Deal visible to the authenticated user.
const getDealById = async (req, res, next) => {
  try {
    // The service verifies both the Deal ID and the user's access
    // before returning the Deal.
    const deal = await dealService.getDealById(
      req.user,
      req.params.dealId,
    );

    // Return the requested Deal.
    return res.status(200).json({
      status: "success",
      data: {
        deal,
      },
    });
  } catch (error) {
    // Pass expected and unexpected errors to the centralized handler.
    return next(error);
  }
};


// Mark the Agreement stage of a Deal as completed.
const completeAgreement = async (
  req,
  res,
  next,
) => {
  try {
    const deal =
      await dealService.completeAgreement(
        req.user,
        req.params.dealId,
      );

    return res.status(200).json({
      status: "success",
      message:
        "Agreement stage completed successfully.",
      data: {
        deal,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Verify payment for an Agreement-completed Deal.
const verifyPayment = async (
  req,
  res,
  next,
) => {
  try {
    const deal =
      await dealService.verifyPayment(
        req.user,
        req.params.dealId,
      );

    return res.status(200).json({
      status: "success",
      message:
        "Deal payment verified successfully.",
      data: {
        deal,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Complete a payment-verified Deal.
const completeDeal = async (
  req,
  res,
  next,
) => {
  try {
    const deal =
      await dealService.completeDeal(
        req.user,
        req.params.dealId,
      );

    return res.status(200).json({
      status: "success",
      message:
        "Deal completed successfully.",
      data: {
        deal,
      },
    });
  } catch (error) {
    return next(error);
  }
};


module.exports = {
  getMyDeals,
  getDealById,
  completeAgreement,
  verifyPayment,
  completeDeal,
};
