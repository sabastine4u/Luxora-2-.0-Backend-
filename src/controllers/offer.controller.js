// Import the Offer service so the controller can use the Offer business logic.
const offerService = require("../services/offer.service");

// Import the Joi validation schema for creating Buyer Offers.
const {
  createOfferSchema,
} = require("../validators/offer.validator");

// Import AppError for validation failures handled by the application's
// centralized error middleware.
const AppError = require("../utils/AppError");

// Create a new Offer for the authenticated Buyer.
const createOffer = async (
  req,
  res,
  next,
) => {
  try {
    // Validate and normalize the incoming Offer payload.
    const {
      error,
      value,
    } = createOfferSchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      },
    );

    // Return a validation error when the submitted data is invalid.
    if (error) {
      throw new AppError(
        error.details
          .map(
            (detail) =>
              detail.message,
          )
          .join(", "),
        400,
      );
    }

    // Create the Offer using the authenticated Buyer's ID.
    const offer =
      await offerService.createOffer(
        req.user._id,
        value,
      );

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
const getMyOffers = async (
  req,
  res,
  next,
) => {
  try {
    // Retrieve only the Offers belonging to the logged-in Buyer.
    const offers =
      await offerService.getOffersByBuyer(
        req.user._id,
      );

    // Return the Buyer's Offers.
    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all Offers submitted against Properties
// owned by the authenticated Owner.
const getOwnerOffers = async (
  req,
  res,
  next,
) => {
  try {
    const offers =
      await offerService.getOffersByOwner(
        req.user._id,
      );

    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all Offers belonging only to Properties
// created by the authenticated Admin.
//
// The service also verifies createdByRole === "Admin"
// so an Admin cannot see another creator's Offers.
const getAdminOffers = async (
  req,
  res,
  next,
) => {
  try {
    /*
     * Super Admin has a global middleware bypass in Luxora,
     * so explicitly enforce the endpoint's intended role here.
     */
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only Admin users can access Admin Offers.",
      });
    }

    const offers =
      await offerService.getOffersByPlatformCreator(
        req.user._id,
        req.user.role,
      );

    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all Offers belonging only to Properties
// created by the authenticated Super Admin.
//
// The service also verifies createdByRole === "Super Admin"
// so Super Admin Offers remain isolated from Admin Offers.
const getSuperAdminOffers =
  async (
    req,
    res,
    next,
  ) => {
    try {
      /*
       * Explicitly enforce the Super Admin endpoint scope.
       */
      if (req.user.role !== "Super Admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only Super Admin users can access Super Admin Offers.",
        });
      }

      const offers =
        await offerService.getOffersByPlatformCreator(
          req.user._id,
          req.user.role,
        );

      return res.status(200).json({
        status: "success",
        results: offers.length,
        data: {
          offers,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

// Withdraw an existing Offer belonging
// to the authenticated Buyer.
const withdrawOffer = async (
  req,
  res,
  next,
) => {
  try {
    const offer =
      await offerService.withdrawOffer(
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

// Accept an incoming Offer for an authorized
// Property Owner, Agent, Admin creator,
// or Super Admin creator.
const acceptOffer = async (
  req,
  res,
  next,
) => {
  try {
    /*
     * Pass the complete authenticated user.
     *
     * The Offer service now needs both:
     * - req.user._id
     * - req.user.role
     *
     * This is what allows it to distinguish:
     * Admin-created Properties from Super Admin-created Properties.
     */
    const offer =
      await offerService.acceptOffer(
        req.user,
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

// Reject an incoming Offer for an authorized
// Property Owner, Agent, Admin creator,
// or Super Admin creator.
const rejectOffer = async (
  req,
  res,
  next,
) => {
  try {
    const offer =
      await offerService.rejectOffer(
        req.user,
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

// Submit a counter offer for an incoming Offer.
const counterOffer = async (
  req,
  res,
  next,
) => {
  try {
    // Read the counter offer information from the request body.
    const {
      counterOfferAmount,
      counterOfferDetails,
    } = req.body;

    /*
     * Pass the complete authenticated user so
     * Admin/Super Admin creator authorization
     * can be enforced by the Offer service.
     */
    const offer =
      await offerService.counterOffer(
        req.user,
        req.params.offerId,
        Number(
          counterOfferAmount,
        ),
        counterOfferDetails,
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

// Accept a counter offer as the authenticated Buyer.
const acceptCounterOffer =
  async (
    req,
    res,
    next,
  ) => {
    try {
      const offer =
        await offerService.acceptCounterOffer(
          req.user._id,
          req.params.offerId,
        );

      return res
        .status(200)
        .json({
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
const rejectCounterOffer =
  async (
    req,
    res,
    next,
  ) => {
    try {
      const offer =
        await offerService.rejectCounterOffer(
          req.user._id,
          req.params.offerId,
        );

      return res
        .status(200)
        .json({
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
const buyerCounterOffer =
  async (
    req,
    res,
    next,
  ) => {
    try {
      // Read the Buyer's new counter amount and message.
      const {
        counterOfferAmount,
        buyerNotes,
      } = req.body;

      const offer =
        await offerService.buyerCounterOffer(
          req.user._id,
          req.params.offerId,
          Number(
            counterOfferAmount,
          ),
          buyerNotes,
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

// Get all Offers associated with the authenticated Agency.
const getAgencyOffers = async (
  req,
  res,
  next,
) => {
  try {
    const offers =
      await offerService.getOffersByAgency(
        req.user._id,
      );

    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all Offers assigned to the authenticated Agent.
const getAgentOffers = async (
  req,
  res,
  next,
) => {
  try {
    const offers =
      await offerService.getOffersByAgent(
        req.user,
      );

    return res.status(200).json({
      status: "success",
      results: offers.length,
      data: {
        offers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createOffer,

  getMyOffers,

  getOwnerOffers,

  getAdminOffers,

  getSuperAdminOffers,

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