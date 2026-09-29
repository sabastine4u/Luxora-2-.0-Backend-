// Import the Offer model so we can create and retrieve Buyer offers.
const Offer = require("../models/offer.model");

// Import the Property model so we can verify the property being offered on.
const Property = require("../models/property.model");

// Import the Agent model so Agent Users can be resolved to their Agent profile.
const Agent = require("../models/agent.model");

const Deal = require("../models/deal.model");

// Import AppError so predictable business-rule failures use the project's
// existing centralized error handling.
const AppError = require("../utils/AppError");


// Create the transaction Deal for an accepted Offer.
//
// This helper is intentionally idempotent:
// retrying the same Offer acceptance must not create
// duplicate Deals.
const createDealFromAcceptedOffer = async (offer) => {
  // The accepted Offer must contain its Property context.
  if (!offer?.property?._id) {
    throw new AppError(
      "The accepted offer is missing its property context.",
      500,
    );
  }

  // Check whether this Offer already created a Deal.
  const existingDeal = await Deal.findOne({
    offer: offer._id,
  });

  // If the Deal already exists, return it instead of creating another one.
  if (existingDeal) {
    return existingDeal;
  }

  // Only one active Deal should exist for a Property at a time.
  const existingPropertyDeal = await Deal.findOne({
    property: offer.property._id,
    status: {
      $nin: ["Cancelled", "Completed"],
    },
  });

  // Prevent a second accepted Offer from creating another active Deal
  // for the same Property.
  if (
    existingPropertyDeal &&
    String(existingPropertyDeal.offer) !== String(offer._id)
  ) {
    throw new AppError(
      "Another active Deal already exists for this property.",
      409,
    );
  }

  // When an Owner counter offer was accepted, the counter amount
  // is the agreed transaction value.
  //
  // Otherwise, the original Buyer offer is the agreed value.
  const agreedAmount =
    typeof offer.counterOfferAmount === "number" &&
    offer.counterOfferAmount > 0
      ? offer.counterOfferAmount
      : offer.offerAmount;

  // Generate a deterministic Deal reference from the Offer ID.
  const dealId = `DEAL-${String(offer._id)
    .slice(-8)
    .toUpperCase()}`;

  // Create the Deal from trusted backend relationships.
  const deal = await Deal.create({
    dealId,
    offer: offer._id,
    property: offer.property._id,
    buyer: offer.buyer,
    owner: offer.property.owner || null,
    agency: offer.agency || offer.property.agency || null,
    agent: offer.agent || offer.property.agent || null,
    transactionType: offer.property.transactionType,
    agreedAmount,
    status: "Agreement Pending",
    agreementStatus: "Pending",
    paymentStatus: "Pending",
  });

  // Move the Property into the transaction stage.
  //
  // This also prevents another Buyer from creating a new offer
  // through the existing createOffer availability checks.
  offer.property.status = "Under Offer";
  offer.property.availabilityStatus = "Unavailable";

  await offer.property.save();

  return deal;
};

// Create a new purchase offer for the authenticated Buyer.
const createOffer = async (buyerId, offerData) => {
  // Find the requested property and include its assignment relationships.
  const property = await Property.findById(offerData.propertyId);

  // Stop the request when the property does not exist.
  if (!property) {
    throw new AppError("Property not found.", 404);
  }

  // Offers are only valid for properties currently listed for purchase.
  if (property.transactionType !== "buy") {
    throw new AppError(
      "Offers can only be submitted for properties listed for sale.",
      400,
    );
  }

  // Only published and available properties can receive new purchase offers.
  if (
    property.status !== "Published" ||
    property.availabilityStatus !== "Available"
  ) {
    throw new AppError(
      "This property is not currently available for an offer.",
      400,
    );
  }

  // Prevent multiple active offers from the same Buyer on the same Property.
  const existingOffer = await Offer.findOne({
    buyer: buyerId,
    property: property._id,
    status: {
      $in: ["Draft", "Submitted", "Under Review", "Counter Offer Received"],
    },
  });

  // Stop the request when the Buyer already has an active offer on this property.
  if (existingOffer) {
    throw new AppError(
      "You already have an active offer on this property.",
      400,
    );
  }

  // Create the offer using only server-controlled relationships and validated Buyer data.
  const offer = await Offer.create({
    buyer: buyerId,
    property: property._id,
    agent: property.agent || null,
    agency: property.agency || null,
    offerAmount: offerData.offerAmount,
    buyerNotes: offerData.buyerNotes || "",
    status: "Submitted",
  });

  // Return the newly created offer with its related Property populated.
  return Offer.findById(offer._id).populate("property");
};

// Get all offers belonging to the authenticated Buyer.
const getOffersByBuyer = async (buyerId) => {
  // Retrieve only offers created by this Buyer.
  return Offer.find({ buyer: buyerId })
    // Include the related Property for the Buyer dashboard.
    .populate("property")
    // Show the newest offers first.
    .sort({ createdAt: -1 });
};

// Withdraw an existing Offer belonging to the authenticated Buyer.
const withdrawOffer = async (buyerId, offerId) => {
  // Find the Offer and make sure it belongs to the authenticated Buyer.
  const offer = await Offer.findOne({
    _id: offerId,
    buyer: buyerId,
  });

  // Stop the request when the Offer does not exist or belongs to another Buyer.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Only active Offer statuses can be withdrawn by the Buyer.
  const withdrawableStatuses = [
    "Draft",
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  // Stop the request when the Offer can no longer be withdrawn.
  if (!withdrawableStatuses.includes(offer.status)) {
    throw new AppError(
      "This offer can no longer be withdrawn.",
      400,
    );
  }

  // Update the Offer status to Withdrawn.
  offer.status = "Withdrawn";

  // Save the updated Offer.
  await offer.save();

  // Return the updated Offer with its Property populated.
  return Offer.findById(offer._id).populate("property");
};


// Get all Offers submitted against Properties owned by the authenticated Owner.
const getOffersByOwner = async (ownerId) => {
  // Find Owner-owned Property IDs first so the Offer query is ownership-safe.
  const ownerProperties = await Property.find({
    owner: ownerId,
  }).select('_id');

  // Convert the Owner's Property documents into IDs for the Offer query.
  const propertyIds = ownerProperties.map((property) => property._id);

  // Retrieve Offers only when their Property belongs to the authenticated Owner.
  return Offer.find({
    property: {
      $in: propertyIds,
    },
  })
    // Include the Property details required by the Owner Offers dashboard.
    .populate('property')
    // Include the Buyer identity and contact details required by the Owner UI.
    .populate({
      path: 'buyer',
      select: 'fullName email phone',
    })
    // Show the newest Offers first.
    .sort({ createdAt: -1 });
};

// Accept an Offer belonging to a Property owned by the authenticated Owner.
const acceptOffer = async (ownerId, offerId) => {
  // Find the Offer and populate its Property so ownership can be verified.
  const offer = await Offer.findById(offerId).populate("property");

  // Stop the request when the Offer does not exist.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Make sure the Offer's Property belongs to the authenticated Owner.
  if (String(offer.property.owner) !== String(ownerId)) {
    throw new AppError("You are not authorized to manage this offer.", 403);
  }

  // Only active negotiation Offers can be accepted.
  const acceptableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  // Stop the request when the Offer has already reached a final state.
  if (!acceptableStatuses.includes(offer.status)) {
    throw new AppError(
      "This offer can no longer be accepted.",
      400,
    );
  }

// Mark the Offer as accepted.
offer.status = "Accepted";

// Save the updated Offer to MongoDB.
await offer.save();

// Create the transaction Deal and move the Property into
// the Under Offer stage.
//
// The helper is idempotent, so a repeated request for the
// same Offer will reuse the existing Deal.
await createDealFromAcceptedOffer(offer);

// Return the updated Offer with its related Property populated.
return Offer.findById(offer._id)

    .populate("property")
    .populate("buyer", "fullName email phone");
};


// Reject an Offer belonging to a Property owned by the authenticated Owner.
const rejectOffer = async (ownerId, offerId) => {
  // Find the Offer and populate its Property so ownership can be verified.
  const offer = await Offer.findById(offerId).populate("property");

  // Stop the request when the Offer does not exist.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Make sure the Offer's Property belongs to the authenticated Owner.
  if (String(offer.property.owner) !== String(ownerId)) {
    throw new AppError("You are not authorized to manage this offer.", 403);
  }

  // Only active negotiation Offers can be rejected.
  const rejectableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  // Stop the request when the Offer has already reached a final state.
  if (!rejectableStatuses.includes(offer.status)) {
    throw new AppError(
      "This offer can no longer be rejected.",
      400,
    );
  }

  // Mark the Offer as rejected.
  offer.status = "Rejected";

  // Save the updated Offer to MongoDB.
  await offer.save();

  // Return the updated Offer with related Buyer and Property data.
  return Offer.findById(offer._id)
    .populate("property")
    .populate("buyer", "fullName email phone");
};


// Submit a counter offer from an Owner to a Buyer.
const counterOffer = async (
  ownerId,
  offerId,
  counterOfferAmount,
  counterOfferDetails,
) => {
  // Find the Offer and populate its Property so ownership can be verified.
  const offer = await Offer.findById(offerId).populate("property");

  // Stop the request when the Offer does not exist.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Make sure the Offer's Property belongs to the authenticated Owner.
  if (String(offer.property.owner) !== String(ownerId)) {
    throw new AppError("You are not authorized to manage this offer.", 403);
  }

  // Only active negotiation Offers can receive a counter offer.
  const counterableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  // Stop the request when the Offer can no longer be negotiated.
  if (!counterableStatuses.includes(offer.status)) {
    throw new AppError(
      "This offer can no longer receive a counter offer.",
      400,
    );
  }

  // Validate the counter amount before saving it.
  if (
    typeof counterOfferAmount !== "number" ||
    counterOfferAmount <= 0
  ) {
    throw new AppError(
      "Counter offer amount must be greater than zero.",
      400,
    );
  }

  // Store the Owner's counter offer amount.
  offer.counterOfferAmount = counterOfferAmount;

  // Store the Owner's explanation for the counter offer.
  offer.counterOfferDetails = counterOfferDetails || "";

  // Use the existing Buyer-facing status for a counter offer.
  offer.status = "Counter Offer Received";

  // Save the negotiation update to MongoDB.
  await offer.save();

  // Return the updated Offer with related Buyer and Property data.
  return Offer.findById(offer._id)
    .populate("property")
    .populate("buyer", "fullName email phone");
};

// Accept a counter offer submitted by the authenticated Buyer.
const acceptCounterOffer = async (buyerId, offerId) => {
  // Find the Offer.
  const offer = await Offer.findById(offerId);

  // Stop when the Offer does not exist.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Make sure the Offer belongs to the authenticated Buyer.
  if (String(offer.buyer) !== String(buyerId)) {
    throw new AppError(
      "You are not authorized to respond to this offer.",
      403,
    );
  }

  // Only an active counter offer can be accepted.
  if (offer.status !== "Counter Offer Received") {
    throw new AppError(
      "This offer does not have a counter offer awaiting your response.",
      400,
    );
  }

 // Accept the Owner's counter offer.
offer.status = "Accepted";

// Save the updated Offer.
await offer.save();

// Create the transaction Deal.
//
// Because the Owner's counter amount is still stored on the Offer,
// createDealFromAcceptedOffer() will use that amount as the
// agreed transaction value.
await createDealFromAcceptedOffer(
  await Offer.findById(offer._id).populate("property"),
);

// Return the updated Offer with its related records populated.
return Offer.findById(offer._id)
    .populate("property")
    .populate("buyer", "fullName email phone");
};


// Reject a counter offer submitted by the authenticated Buyer.
const rejectCounterOffer = async (buyerId, offerId) => {
  // Find the Offer.
  const offer = await Offer.findById(offerId);

  // Stop when the Offer does not exist.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // Make sure the Offer belongs to the authenticated Buyer.
  if (String(offer.buyer) !== String(buyerId)) {
    throw new AppError(
      "You are not authorized to respond to this offer.",
      403,
    );
  }

  // Only an active counter offer can be rejected.
  if (offer.status !== "Counter Offer Received") {
    throw new AppError(
      "This offer does not have a counter offer awaiting your response.",
      400,
    );
  }

  // Reject the Owner's counter offer.
  offer.status = "Rejected";

  // Save the updated Offer.
  await offer.save();

  // Return the updated Offer with its related records populated.
  return Offer.findById(offer._id)
    .populate("property")
    .populate("buyer", "fullName email phone");
};

// Submit a new counter offer from the authenticated Buyer.
const buyerCounterOffer = async (
  buyerId,
  offerId,
  counterOfferAmount,
  buyerNotes,
) => {
  // Find the Offer and make sure it belongs to the authenticated Buyer.
  const offer = await Offer.findOne({
    _id: offerId,
    buyer: buyerId,
  }).populate("property");

  // Stop when the Offer does not exist or belongs to another Buyer.
  if (!offer) {
    throw new AppError("Offer not found.", 404);
  }

  // A Buyer can only counter an active Owner counter offer.
  if (offer.status !== "Counter Offer Received") {
    throw new AppError(
      "This offer does not currently have a counter offer awaiting your response.",
      400,
    );
  }

  // Validate the new Buyer counter amount.
  if (
    typeof counterOfferAmount !== "number" ||
    counterOfferAmount <= 0
  ) {
    throw new AppError(
      "Counter offer amount must be greater than zero.",
      400,
    );
  }

  // Replace the current Buyer offer with the Buyer's new counter amount.
  offer.offerAmount = counterOfferAmount;

  // Store the Buyer's latest negotiation message.
  offer.buyerNotes = buyerNotes || "";

  // The Owner's previous counter has now been answered.
  offer.counterOfferAmount = null;
  offer.counterOfferDetails = "";

  // Return the Offer to the normal submitted state so the Owner can respond.
  offer.status = "Submitted";

  // Save the negotiation update.
  await offer.save();

  // Return the updated Offer with its related records populated.
  return Offer.findById(offer._id)
    .populate("property")
    .populate("buyer", "fullName email phone");
};

// Get all Offers associated with Properties belonging to the authenticated Agency.
const getOffersByAgency = async (agencyId) => {
  // Retrieve Offers using the Agency relationship already stored when the Buyer created the Offer.
  return Offer.find({
    agency: agencyId,
  })
    // Include the Property so the Agency can see the transaction and lifecycle status.
    .populate({
      path: "property",
      select:
        "title status availabilityStatus transactionType price agencyFee agent agency owner",
    })

    // Include the Buyer identity needed for transaction review.
    .populate({
      path: "buyer",
      select: "fullName email phone",
    })

    // Include the assigned Agent responsible for the transaction.
    .populate({
      path: "agent",
      select: "fullName email agentShare agencyShare commissionModel",
    })

    // Newest offers appear first in the Agency transaction view.
    .sort({
      createdAt: -1,
    });
};
// Get all Offers assigned to the authenticated Agent.
const getOffersByAgent = async (authenticatedUser) => {
  // Ensure a valid authenticated user was provided.
  if (!authenticatedUser?._id || !authenticatedUser?.role) {
    throw new AppError(
      "Authenticated user information is required",
      401,
    );
  }

  // Only Agent users can access their assigned Offers.
  if (authenticatedUser.role !== "Agent") {
    throw new AppError(
      "Only Agents can access agent Offers",
      403,
    );
  }

  // Find the Agent profile linked to the authenticated User account.
  const agent = await Agent.findOne({
    user: authenticatedUser._id,
  }).select("_id agency status");

  // Stop when the authenticated User has no Agent profile.
  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      403,
    );
  }

  // Only Active Agents can access their transaction pipeline.
  if (agent.status !== "Active") {
    throw new AppError(
      "Only active Agents can access agent Offers",
      403,
    );
  }

  // Retrieve only Offers assigned to this Agent profile.
  return Offer.find({
    agent: agent._id,
  })
    // Include the Property details required by the Agent Deals dashboard.
    .populate({
      path: "property",
      select:
        "title status availabilityStatus transactionType price agencyFee agent agency owner",
    })

    // Include the Buyer identity and contact details required by the Agent.
    .populate({
      path: "buyer",
      select: "fullName email phone",
    })

    // Include the Agency associated with the transaction.
    .populate({
      path: "agency",
      select: "name status",
    })

    // Newest Offers appear first.
    .sort({
      createdAt: -1,
    });
};

module.exports = {
  createOffer,
  getOffersByBuyer,
  getOffersByOwner,
  getOffersByAgency,
  getOffersByAgent,
  withdrawOffer,
  acceptOffer,
  rejectOffer,
  counterOffer,
  acceptCounterOffer,
  rejectCounterOffer,
  buyerCounterOffer,
};