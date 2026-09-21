// Import the Offer service so the controller can use the Offer business logic.
const offerService = require("../services/offer.service");

// Import the Joi validation schema for creating Buyer Offers.
const { createOfferSchema } = require("../validators/offer.validator");

// Import AppError for validation failures handled by the application's
// centralized error middleware.
const AppError = require("../utils/AppError");

// Create a new Offer for the authenticated Buyer.
const createOffer = async (req, res, next) => {
  try {
    // Validate and normalize the incoming Offer payload.
    const { error, value } = createOfferSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Return a validation error when the submitted data is invalid.
    if (error) {
      throw new AppError(
        error.details.map((detail) => detail.message).join(", "),
        400,
      );
    }

    // Create the Offer using the authenticated Buyer's ID.
    const offer = await offerService.createOffer(req.user._id, value);

    // Return the newly created Offer.
    return res.status(201).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get all Offers belonging to the authenticated Buyer.
const getMyOffers = async (req, res, next) => {
  try {
    // Retrieve only the Offers belonging to the logged-in Buyer.
    const offers = await offerService.getOffersByBuyer(req.user._id);

    // Return the Buyer's Offers.
    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get all Offers submitted against Properties owned by the authenticated Owner.
const getOwnerOffers = async (req, res, next) => {
  try {
    // Retrieve Offers belonging to Properties owned by the logged-in Owner.
    const offers = await offerService.getOffersByOwner(req.user._id);

    // Return the Owner's incoming Offers.
    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Withdraw an existing Offer belonging to the authenticated Buyer.
const withdrawOffer = async (req, res, next) => {
  try {
    // Withdraw the Offer only when it belongs to the authenticated Buyer.
    const offer = await offerService.withdrawOffer(
      req.user._id,
      req.params.offerId,
    );

    // Return the updated Offer.
    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Accept an incoming Offer for a Property owned by the authenticated Owner.
const acceptOffer = async (req, res, next) => {
  try {
    // Accept the Offer using the authenticated Owner's ID.
    const offer = await offerService.acceptOffer(
      req.user._id,
      req.params.offerId,
    );

    // Return the updated Offer.
    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized handler.
    return next(error);
  }
};

// Reject an incoming Offer for a Property owned by the authenticated Owner.
const rejectOffer = async (req, res, next) => {
  try {
    // Reject the Offer using the authenticated Owner's ID.
    const offer = await offerService.rejectOffer(
      req.user._id,
      req.params.offerId,
    );

    // Return the updated Offer.
    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized handler.
    return next(error);
  }
};

// Submit a counter offer for an incoming Offer.
const counterOffer = async (req, res, next) => {
  try {
    // Read the counter offer information from the request body.
    const { counterOfferAmount, counterOfferDetails } = req.body;

    // Submit the counter offer using the authenticated Owner's ID.
    const offer = await offerService.counterOffer(
      req.user._id,
      req.params.offerId,
      Number(counterOfferAmount),
      counterOfferDetails,
    );

    // Return the updated Offer.
    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized handler.
    return next(error);
  }
};

// Accept a counter offer as the authenticated Buyer.
const acceptCounterOffer = async (req, res, next) => {
  try {
    const offer = await offerService.acceptCounterOffer(
      req.user._id,
      req.params.offerId,
    );

    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    return next(error);
  }
};


// Reject a counter offer as the authenticated Buyer.
const rejectCounterOffer = async (req, res, next) => {
  try {
    const offer = await offerService.rejectCounterOffer(
      req.user._id,
      req.params.offerId,
    );

    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Submit a new counter offer as the authenticated Buyer.
const buyerCounterOffer = async (req, res, next) => {
  try {
    // Read the Buyer's new counter amount and message.
    const { counterOfferAmount, buyerNotes } = req.body;

    // Submit the Buyer's counter offer using the authenticated Buyer ID.
    const offer = await offerService.buyerCounterOffer(
      req.user._id,
      req.params.offerId,
      Number(counterOfferAmount),
      buyerNotes,
    );

    // Return the updated Offer.
    return res.status(200).json({
      status: "success",
      data: {
        offer,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all Offers associated with the authenticated Agency.
const getAgencyOffers = async (req, res, next) => {
  try {
    // Retrieve only Offers linked to the Agency represented by the logged-in user.
    const offers = await offerService.getOffersByAgency(req.user._id);

    // Return the Agency's Offers.
    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};
// Get all Offers assigned to the authenticated Agent.
const getAgentOffers = async (req, res, next) => {
  try {
    const offers = await offerService.getOffersByAgent(req.user);

    // Return the Agent's Offers.
    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the centralized error handler.
    return next(error);
  }
};

module.exports = {
  createOffer,
  getMyOffers,
  getOwnerOffers,
  getAgencyOffers,
  getAgentOffers,
  withdrawOffer,
  acceptOffer,
  rejectOffer,
  counterOffer,
  acceptCounterOffer,
  rejectCounterOffer,
  buyerCounterOffer,
};
