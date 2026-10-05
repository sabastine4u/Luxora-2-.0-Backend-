const Offer = require("../models/offer.model");
const Property = require("../models/property.model");
const Agent = require("../models/agent.model");
const Agency = require("../models/agency.model");
const Deal = require("../models/deal.model");
const AppError = require("../utils/AppError");

const {
  getOrCreateDirectConversation,
} = require("./conversation.service");

const {
  createEventMessage,
} = require("./message.service");

/**
 * Creates a business event inside the persistent
 * Buyer ↔ Agent / Agency / Platform Creator
 * conversation for an Offer.
 *
 * Messaging is intentionally best-effort.
 * A valid Offer operation must never fail because
 * an event message could not be written.
 */
const emitOfferEvent = async ({
  offer,
  actorUserId,
  body,
  eventKey,
}) => {
  try {
    let recipientUserId = null;

    /*
     * Prefer the assigned Agent.
     *
     * Offer.agent stores the Agent profile ID,
     * while Conversation participants use User IDs.
     */
    if (offer.agent) {
      const agent = await Agent.findById(
        offer.agent,
      )
        .select("user")
        .lean();

      recipientUserId =
        agent?.user || null;
    }

    /*
     * Fall back to the Agency account when there
     * is no assigned Agent.
     */
    if (
      !recipientUserId &&
      offer.agency
    ) {
      const agency =
        await Agency.findById(
          offer.agency,
        )
          .select("user")
          .lean();

      recipientUserId =
        agency?.user || null;
    }

    /*
     * Admin and Super Admin listings may have
     * neither an Agent nor an Agency.
     *
     * In that case, the Property creator is
     * the correct Offer recipient.
     */
    if (
      !recipientUserId &&
      offer.property?.createdBy &&
      ["Admin", "Super Admin"].includes(
        offer.property?.createdByRole,
      )
    ) {
      recipientUserId =
        offer.property.createdBy;
    }

    /*
     * There is no valid communication recipient yet.
     */
    if (!recipientUserId) {
      console.warn(
        `Offer ${offer._id} has no messaging recipient; skipping Offer event.`,
      );

      return null;
    }

    /*
     * Reuse the same persistent conversation for
     * this Buyer ↔ recipient pair.
     */
    const conversation =
      await getOrCreateDirectConversation(
        offer.buyer,
        recipientUserId,
      );

    /*
     * Business context belongs to the event message,
     * not to the identity of the conversation.
     */
    return createEventMessage({
      conversationId:
        conversation._id,

      senderUserId:
        actorUserId,

      body,

      context: {
        type: "offer",
        resourceId: offer._id,
      },

      /*
       * Prevent duplicate event messages if the
       * same Offer operation is retried.
       */
      dedupeKey:
        `offer:${offer._id}:${eventKey}`,
    });
  } catch (error) {
    /*
     * Messaging failures must never roll back a
     * successful Offer transaction.
     */
    console.error(
      `Failed to create Offer messaging event for ${offer._id}:`,
      error,
    );

    return null;
  }
};

// Create the transaction Deal for an accepted Offer.
//
// This helper is intentionally idempotent:
// retrying the same Offer acceptance must not create
// duplicate Deals.
const createDealFromAcceptedOffer =
  async (offer) => {
    /*
     * The accepted Offer must contain its
     * Property context.
     */
    if (!offer?.property?._id) {
      throw new AppError(
        "The accepted offer is missing its property context.",
        500,
      );
    }

    /*
     * Check whether this Offer already created
     * a Deal.
     */
    const existingDeal =
      await Deal.findOne({
        offer: offer._id,
      });

    if (existingDeal) {
      return existingDeal;
    }

    /*
     * Only one active Deal should exist for a
     * Property at a time.
     */
    const existingPropertyDeal =
      await Deal.findOne({
        property:
          offer.property._id,

        status: {
          $nin: [
            "Cancelled",
            "Completed",
          ],
        },
      });

    /*
     * Prevent another accepted Offer from creating
     * a second active Deal for the same Property.
     */
    if (
      existingPropertyDeal &&
      String(
        existingPropertyDeal.offer,
      ) !== String(offer._id)
    ) {
      throw new AppError(
        "Another active Deal already exists for this property.",
        409,
      );
    }

    /*
     * If an Owner / Agent / Admin / Super Admin
     * counter offer was accepted, the counter
     * amount becomes the agreed value.
     *
     * Otherwise the original Buyer Offer amount
     * becomes the agreed value.
     */
    const agreedAmount =
      typeof offer.counterOfferAmount ===
        "number" &&
      offer.counterOfferAmount > 0
        ? offer.counterOfferAmount
        : offer.offerAmount;

    /*
     * Deterministic Deal reference generated
     * from the Offer ID.
     */
    const dealId =
      `DEAL-${String(offer._id)
        .slice(-8)
        .toUpperCase()}`;

    /*
     * Create the Deal from trusted backend relationships.
     */
    const deal = await Deal.create({
      dealId,

      offer: offer._id,

      property:
        offer.property._id,

      buyer:
        offer.buyer,

      owner:
        offer.property.owner ||
        null,

      agency:
        offer.agency ||
        offer.property.agency ||
        null,

      agent:
        offer.agent ||
        offer.property.agent ||
        null,

      transactionType:
        offer.property.transactionType,

      agreedAmount,

      status:
        "Agreement Pending",

      agreementStatus:
        "Pending",

      paymentStatus:
        "Pending",
    });

    /*
     * Move the Property into the transaction stage.
     */
    offer.property.status =
      "Under Offer";

    offer.property.availabilityStatus =
      "Unavailable";

    await offer.property.save();

    return deal;
  };

// Create a new purchase offer for the authenticated Buyer.
const createOffer = async (
  buyerId,
  offerData,
) => {
  /*
   * Find the requested Property.
   */
  const property =
    await Property.findById(
      offerData.propertyId,
    );

  if (!property) {
    throw new AppError(
      "Property not found.",
      404,
    );
  }

  /*
   * Offers are only valid for properties
   * currently listed for purchase.
   */
  if (
    property.transactionType !==
    "buy"
  ) {
    throw new AppError(
      "Offers can only be submitted for properties listed for sale.",
      400,
    );
  }

  /*
   * Only published and available Properties
   * can receive new purchase offers.
   */
  if (
    property.status !==
      "Published" ||
    property.availabilityStatus !==
      "Available"
  ) {
    throw new AppError(
      "This property is not currently available for an offer.",
      400,
    );
  }

  /*
   * Prevent multiple active Offers from the
   * same Buyer on the same Property.
   */
  const existingOffer =
    await Offer.findOne({
      buyer: buyerId,

      property:
        property._id,

      status: {
        $in: [
          "Draft",
          "Submitted",
          "Under Review",
          "Counter Offer Received",
        ],
      },
    });

  if (existingOffer) {
    throw new AppError(
      "You already have an active offer on this property.",
      400,
    );
  }

  /*
   * Create the Offer using only server-controlled
   * relationships and validated Buyer data.
   */
  const offer =
    await Offer.create({
      buyer: buyerId,

      property:
        property._id,

      agent:
        property.agent ||
        null,

      agency:
        property.agency ||
        null,

      offerAmount:
        offerData.offerAmount,

      buyerNotes:
        offerData.buyerNotes ||
        "",

      status:
        "Submitted",
    });

  /*
   * Populate the saved Offer before generating
   * the messaging event.
   */
  const populatedOffer =
    await Offer.findById(
      offer._id,
    ).populate({
      path: "property",
      select:
        "title status availabilityStatus transactionType price owner agency agent createdBy createdByRole origin",
    });

  /*
   * Add the Offer submission to the existing
   * persistent Buyer ↔ Agent / Agency /
   * Platform Creator conversation.
   */
  await emitOfferEvent({
    offer:
      populatedOffer,

    actorUserId:
      buyerId,

    body:
      `Offer submitted — ₦${Number(
        offer.offerAmount || 0,
      ).toLocaleString(
        "en-NG",
      )} for "${
        populatedOffer.property?.title ||
        "the property"
      }".`,

    eventKey:
      "submitted",
  });

  return populatedOffer;
};

// Get all offers belonging to the authenticated Buyer.
const getOffersByBuyer =
  async (buyerId) => {
    return Offer.find({
      buyer: buyerId,
    })
      .populate("property")
      .sort({
        createdAt: -1,
      });
  };

// Withdraw an existing Offer belonging
// to the authenticated Buyer.
const withdrawOffer = async (
  buyerId,
  offerId,
) => {
  const offer =
    await Offer.findOne({
      _id: offerId,
      buyer: buyerId,
    });

  if (!offer) {
    throw new AppError(
      "Offer not found.",
      404,
    );
  }

  const withdrawableStatuses = [
    "Draft",
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  if (
    !withdrawableStatuses.includes(
      offer.status,
    )
  ) {
    throw new AppError(
      "This offer can no longer be withdrawn.",
      400,
    );
  }

  offer.status =
    "Withdrawn";

  await offer.save();

  return Offer.findById(
    offer._id,
  ).populate("property");
};

// Get all Offers submitted against
// Properties owned by the authenticated Owner.
const getOffersByOwner =
  async (ownerId) => {
    const ownerProperties =
      await Property.find({
        owner: ownerId,
      }).select("_id");

    const propertyIds =
      ownerProperties.map(
        (property) =>
          property._id,
      );

    return Offer.find({
      property: {
        $in: propertyIds,
      },
    })
      .populate("property")
      .populate({
        path: "buyer",
        select:
          "fullName email phone",
      })
      .sort({
        createdAt: -1,
      });
  };

// Get Offers only for Properties created by
// the authenticated Admin or Super Admin.
//
// Creator role is included in the Property query
// so Admins and Super Admins cannot see each
// other's Offers.
const getOffersByPlatformCreator =
  async (
    userId,
    creatorRole,
  ) => {
    if (
      ![
        "Admin",
        "Super Admin",
      ].includes(
        creatorRole,
      )
    ) {
      throw new AppError(
        "Only Admin and Super Admin users can access creator Offers.",
        403,
      );
    }

    const creatorProperties =
      await Property.find({
        createdBy: userId,
        createdByRole:
          creatorRole,
      }).select("_id");

    const propertyIds =
      creatorProperties.map(
        (property) =>
          property._id,
      );

    return Offer.find({
      property: {
        $in: propertyIds,
      },
    })
      .populate({
        path: "property",
        select:
          "title status availabilityStatus transactionType price owner agency agent createdBy createdByRole origin",
      })
      .populate({
        path: "buyer",
        select:
          "fullName email phone",
      })
      .populate({
        path: "agency",
        select:
          "name status",
      })
      .populate({
        path: "agent",
        select:
          "fullName email phone status",
      })
      .sort({
        createdAt: -1,
      });
  };

/*
 * Determine whether an authenticated user
 * can manage an incoming Offer.
 *
 * Supported actors:
 *
 * 1. Property Owner
 * 2. Assigned active Agent
 * 3. Admin who created the Property
 * 4. Super Admin who created the Property
 *
 * Admin and Super Admin creator matching requires
 * BOTH the User ID and the Property createdByRole.
 */
const canManageIncomingOffer =
  async (
    user,
    property,
  ) => {
    if (
      !user?._id ||
      !user?.role ||
      !property
    ) {
      return false;
    }

    const userId =
      String(user._id);

    /*
     * Property Owner
     */
    const isPropertyOwner =
      Boolean(
        property.owner,
      ) &&
      String(
        property.owner,
      ) === userId;

    if (isPropertyOwner) {
      return true;
    }

    /*
     * Assigned Agent
     */
    if (
      property.agent &&
      user.role === "Agent"
    ) {
      const assignedAgent =
        await Agent.findOne({
          _id:
            property.agent,
          user:
            user._id,
          status:
            "Active",
        }).select("_id");

      if (assignedAgent) {
        return true;
      }
    }

    /*
     * Admin / Super Admin Property Creator
     */
    const isPlatformCreator =
      [
        "Admin",
        "Super Admin",
      ].includes(
        user.role,
      ) &&
      Boolean(
        property.createdBy,
      ) &&
      String(
        property.createdBy,
      ) === userId &&
      property.createdByRole ===
        user.role;

    return Boolean(
      isPlatformCreator,
    );
  };

// Accept an Offer belonging to an authorized
// Property Owner, assigned Agent, Admin creator,
// or Super Admin creator.
const acceptOffer = async (
  user,
  offerId,
) => {
  const offer =
    await Offer.findById(
      offerId,
    ).populate("property");

  if (!offer) {
    throw new AppError(
      "Offer not found.",
      404,
    );
  }

  const canManage =
    await canManageIncomingOffer(
      user,
      offer.property,
    );

  if (!canManage) {
    throw new AppError(
      "You are not authorized to manage this offer.",
      403,
    );
  }

  const acceptableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  if (
    !acceptableStatuses.includes(
      offer.status,
    )
  ) {
    throw new AppError(
      "This offer can no longer be accepted.",
      400,
    );
  }

  offer.status =
    "Accepted";

  await offer.save();

  await createDealFromAcceptedOffer(
    offer,
  );

  return Offer.findById(
    offer._id,
  )
    .populate("property")
    .populate(
      "buyer",
      "fullName email phone",
    );
};

// Reject an Offer belonging to an authorized
// Property Owner, assigned Agent, Admin creator,
// or Super Admin creator.
const rejectOffer = async (
  user,
  offerId,
) => {
  const offer =
    await Offer.findById(
      offerId,
    ).populate("property");

  if (!offer) {
    throw new AppError(
      "Offer not found.",
      404,
    );
  }

  const canManage =
    await canManageIncomingOffer(
      user,
      offer.property,
    );

  if (!canManage) {
    throw new AppError(
      "You are not authorized to manage this offer.",
      403,
    );
  }

  const rejectableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  if (
    !rejectableStatuses.includes(
      offer.status,
    )
  ) {
    throw new AppError(
      "This offer can no longer be rejected.",
      400,
    );
  }

  offer.status =
    "Rejected";

  await offer.save();

  return Offer.findById(
    offer._id,
  )
    .populate("property")
    .populate(
      "buyer",
      "fullName email phone",
    );
};

// Submit a counter offer from an authorized
// Property Owner, assigned Agent, Admin creator,
// or Super Admin creator to a Buyer.
const counterOffer = async (
  user,
  offerId,
  counterOfferAmount,
  counterOfferDetails,
) => {
  const offer =
    await Offer.findById(
      offerId,
    ).populate("property");

  if (!offer) {
    throw new AppError(
      "Offer not found.",
      404,
    );
  }

  const canManage =
    await canManageIncomingOffer(
      user,
      offer.property,
    );

  if (!canManage) {
    throw new AppError(
      "You are not authorized to manage this offer.",
      403,
    );
  }

  const counterableStatuses = [
    "Submitted",
    "Under Review",
    "Counter Offer Received",
  ];

  if (
    !counterableStatuses.includes(
      offer.status,
    )
  ) {
    throw new AppError(
      "This offer can no longer receive a counter offer.",
      400,
    );
  }

  if (
    typeof counterOfferAmount !==
      "number" ||
    counterOfferAmount <= 0
  ) {
    throw new AppError(
      "Counter offer amount must be greater than zero.",
      400,
    );
  }

  offer.counterOfferAmount =
    counterOfferAmount;

  offer.counterOfferDetails =
    counterOfferDetails ||
    "";

  offer.status =
    "Counter Offer Received";

  /*
   * Save the negotiation update to MongoDB.
   */
  await offer.save();

  /*
   * Add the counter offer to the existing
   * persistent Buyer ↔ Agent / Agency /
   * Platform Creator conversation.
   */
  await emitOfferEvent({
    offer,

    actorUserId:
      user._id,

    body:
      `Counter offer received — ₦${Number(
        offer.counterOfferAmount ||
          0,
      ).toLocaleString(
        "en-NG",
      )} for "${
        offer.property?.title ||
        "the property"
      }".`,

    eventKey:
      "counter_received",
  });

  /*
   * Return the updated Offer with related
   * Buyer and Property data.
   */
  return Offer.findById(
    offer._id,
  )
    .populate("property")
    .populate(
      "buyer",
      "fullName email phone",
    );
};

// Accept a counter offer submitted
// by the authenticated Buyer.
const acceptCounterOffer =
  async (
    buyerId,
    offerId,
  ) => {
    const offer =
      await Offer.findById(
        offerId,
      );

    if (!offer) {
      throw new AppError(
        "Offer not found.",
        404,
      );
    }

    if (
      String(offer.buyer) !==
      String(buyerId)
    ) {
      throw new AppError(
        "You are not authorized to respond to this offer.",
        403,
      );
    }

    if (
      offer.status !==
      "Counter Offer Received"
    ) {
      throw new AppError(
        "This offer does not have a counter offer awaiting your response.",
        400,
      );
    }

    offer.status =
      "Accepted";

    await offer.save();

    await createDealFromAcceptedOffer(
      await Offer.findById(
        offer._id,
      ).populate(
        "property",
      ),
    );

    return Offer.findById(
      offer._id,
    )
      .populate("property")
      .populate(
        "buyer",
        "fullName email phone",
      );
  };

// Reject a counter offer submitted
// by the authenticated Buyer.
const rejectCounterOffer =
  async (
    buyerId,
    offerId,
  ) => {
    const offer =
      await Offer.findById(
        offerId,
      );

    if (!offer) {
      throw new AppError(
        "Offer not found.",
        404,
      );
    }

    if (
      String(offer.buyer) !==
      String(buyerId)
    ) {
      throw new AppError(
        "You are not authorized to respond to this offer.",
        403,
      );
    }

    if (
      offer.status !==
      "Counter Offer Received"
    ) {
      throw new AppError(
        "This offer does not have a counter offer awaiting your response.",
        400,
      );
    }

    offer.status =
      "Rejected";

    await offer.save();

    return Offer.findById(
      offer._id,
    )
      .populate("property")
      .populate(
        "buyer",
        "fullName email phone",
      );
  };

// Submit a new counter offer
// from the authenticated Buyer.
const buyerCounterOffer =
  async (
    buyerId,
    offerId,
    counterOfferAmount,
    buyerNotes,
  ) => {
    const offer =
      await Offer.findOne({
        _id: offerId,
        buyer: buyerId,
      }).populate("property");

    if (!offer) {
      throw new AppError(
        "Offer not found.",
        404,
      );
    }

    if (
      offer.status !==
      "Counter Offer Received"
    ) {
      throw new AppError(
        "This offer does not currently have a counter offer awaiting your response.",
        400,
      );
    }

    if (
      typeof counterOfferAmount !==
        "number" ||
      counterOfferAmount <= 0
    ) {
      throw new AppError(
        "Counter offer amount must be greater than zero.",
        400,
      );
    }

    offer.offerAmount =
      counterOfferAmount;

    offer.buyerNotes =
      buyerNotes || "";

    offer.counterOfferAmount =
      null;

    offer.counterOfferDetails =
      "";

    offer.status =
      "Submitted";

    await offer.save();

    return Offer.findById(
      offer._id,
    )
      .populate("property")
      .populate(
        "buyer",
        "fullName email phone",
      );
  };

// Get all Offers associated with
// Properties belonging to the authenticated Agency.
const getOffersByAgency =
  async (agencyId) => {
    return Offer.find({
      agency: agencyId,
    })
      .populate({
        path: "property",
        select:
          "title status availabilityStatus transactionType price agencyFee agent agency owner createdBy createdByRole origin",
      })
      .populate({
        path: "buyer",
        select:
          "fullName email phone",
      })
      .populate({
        path: "agent",
        select:
          "fullName email agentShare agencyShare commissionModel",
      })
      .sort({
        createdAt: -1,
      });
  };

// Get all Offers assigned to the authenticated Agent.
const getOffersByAgent =
  async (
    authenticatedUser,
  ) => {
    if (
      !authenticatedUser?._id ||
      !authenticatedUser?.role
    ) {
      throw new AppError(
        "Authenticated user information is required",
        401,
      );
    }

    if (
      authenticatedUser.role !==
      "Agent"
    ) {
      throw new AppError(
        "Only Agents can access agent Offers",
        403,
      );
    }

    const agent =
      await Agent.findOne({
        user:
          authenticatedUser._id,
      }).select(
        "_id agency status",
      );

    if (!agent) {
      throw new AppError(
        "Agent profile not found for the authenticated user",
        403,
      );
    }

    if (
      agent.status !==
      "Active"
    ) {
      throw new AppError(
        "Only active Agents can access agent Offers",
        403,
      );
    }

    return Offer.find({
      agent: agent._id,
    })
      .populate({
        path: "property",
        select:
          "title status availabilityStatus transactionType price agencyFee agent agency owner createdBy createdByRole origin",
      })
      .populate({
        path: "buyer",
        select:
          "fullName email phone",
      })
      .populate({
        path: "agency",
        select:
          "name status",
      })
      .sort({
        createdAt: -1,
      });
  };

module.exports = {
  createOffer,

  getOffersByBuyer,

  getOffersByOwner,

  getOffersByPlatformCreator,

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