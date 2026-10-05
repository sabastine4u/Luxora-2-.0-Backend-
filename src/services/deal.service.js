// Import Mongoose so Deal IDs can be validated before querying.
const mongoose = require("mongoose");

// Import the Deal model used by the transaction workflow.
const Deal = require("../models/deal.model");

// Import Property because completing a Deal also finalizes
// the lifecycle state of the related Property.
const Property = require("../models/property.model");

// Import the Agent model because Deal.agent references
// the Agent profile, not the authenticated User directly.
const Agent = require("../models/agent.model");

// Import the Agency model because Agency accounts also
// authenticate through a linked User account.
const Agency = require("../models/agency.model");

// Commission is created automatically when a Deal is completed.
const {
  createCommissionFromCompletedDeal,
} = require("./commission.service");

// Import the application's canonical role constants.
const { ROLES } = require("../config/constants");

// Import AppError for predictable business-rule failures.
const AppError = require("../utils/AppError");

/*
 * Populate the Deal with the relationships needed by
 * Buyer, Owner, Agent, Agency and administrative dashboards.
 *
 * We are deliberately using the real stored fields only.
 * No agreement, payment or completion data is fabricated here.
 */
const populateDeal = (query) => {
  return query
    .populate({
      path: "offer",
      select:
        "offerAmount counterOfferAmount status buyerNotes agentNotes counterOfferDetails estimatedClosing expiresAt createdAt updatedAt",
    })
    .populate({
      path: "property",
      select:
        "title address area city state propertyType transactionType price currency coverImage status availabilityStatus owner agency agent",
    })
    .populate({
      path: "buyer",
      select: "fullName email phone avatar role",
    })
    .populate({
      path: "owner",
      select: "fullName email phone avatar role",
    })
    .populate({
      path: "agency",
      select: "name status contactPerson email phone",
    })
    .populate({
      path: "agent",
      select: "fullName email phone status user agency",
      populate: {
        path: "user",
        select: "_id fullName email role",
      },
    })
    .populate({
      path: "agreementCompletedBy",
      select: "fullName email role",
    })
    .populate({
      path: "paymentVerifiedBy",
      select: "fullName email role",
    })
    .populate({
      path: "completedBy",
      select: "fullName email role",
    })
    .populate({
      path: "cancelledBy",
      select: "fullName email role",
    });
};

/*
 * Build the MongoDB filter that limits Deal visibility
 * to the authenticated user's actual business relationship
 * with the Deal.
 */
const getDealAccessFilter = async (user) => {
  if (!user?._id || !user?.role) {
    throw new AppError(
      "Authenticated user context is required.",
      401,
    );
  }

  /*
   * Administrative and Finance oversight roles can read
   * the Deal domain across the platform.
   */
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.SUPER_ADMIN ||
    user.role === ROLES.FINANCE
  ) {
    return {};
  }

  /*
   * Buyer Deals are linked directly to the authenticated User.
   */
  if (user.role === ROLES.BUYER) {
    return {
      buyer: user._id,
    };
  }

  /*
   * Owner Deals are linked directly to the authenticated User.
   */
  if (user.role === ROLES.OWNER) {
    return {
      owner: user._id,
    };
  }

  /*
   * Agent Deals are linked to the Agent profile rather than
   * directly to the authenticated User.
   */
  if (user.role === ROLES.AGENT) {
    const agent = await Agent.findOne({
      user: user._id,
    }).select("_id status");

    if (!agent) {
      throw new AppError(
        "Agent profile not found.",
        404,
      );
    }

    if (agent.status !== "Active") {
      throw new AppError(
        "The agent account is inactive.",
        403,
      );
    }

    return {
      agent: agent._id,
    };
  }

  /*
   * Agency Deals are linked to the Agency profile rather than
   * directly to the authenticated User.
   */
  if (user.role === ROLES.AGENCY) {
    const agency = await Agency.findOne({
      user: user._id,
    }).select("_id status");

    if (!agency) {
      throw new AppError(
        "Agency profile not found.",
        404,
      );
    }

    if (agency.status !== "Active") {
      throw new AppError(
        "The agency account is inactive.",
        403,
      );
    }

    return {
      agency: agency._id,
    };
  }

  /*
   * All other roles are not automatically granted Deal access.
   * They can be added later when their Deal responsibilities
   * are explicitly defined.
   */
  throw new AppError(
    "You are not authorized to access Deals.",
    403,
  );
};

/*
 * Retrieve all Deals visible to the authenticated user.
 */
const getMyDeals = async (user) => {
  const accessFilter =
    await getDealAccessFilter(user);

  const query = Deal.find(accessFilter)
    .sort({
      createdAt: -1,
    });

  return populateDeal(query);
};

/*
 * Retrieve one Deal only when the authenticated user
 * is actually authorized to see that Deal.
 */
const getDealById = async (
  user,
  dealId,
) => {
  if (
    !dealId ||
    !mongoose.isValidObjectId(dealId)
  ) {
    throw new AppError(
      "Invalid Deal ID.",
      400,
    );
  }

  const accessFilter =
    await getDealAccessFilter(user);

  const query = Deal.findOne({
    _id: dealId,
    ...accessFilter,
  });

  const deal = await populateDeal(query);

  if (!deal) {
    throw new AppError(
      "Deal not found.",
      404,
    );
  }

  return deal;
};

// Mark the Agreement stage as completed for an existing Deal.
//
// This does not create a contract, signature, upload, or legal record.
// It only records that the Agreement stage of the transaction has
// been completed.
const completeAgreement = async (
  user,
  dealId,
) => {
  if (
    !dealId ||
    !mongoose.isValidObjectId(dealId)
  ) {
    throw new AppError(
      "Invalid Deal ID.",
      400,
    );
  }

  // Resolve the Deal access filter using the same
  // participant/role rules used by the read endpoints.
  const accessFilter =
    await getDealAccessFilter(user);

  const deal = await Deal.findOne({
    _id: dealId,
    ...accessFilter,
  });

  if (!deal) {
    throw new AppError(
      "Deal not found.",
      404,
    );
  }

  // Agreement can only be completed while the Deal
  // is waiting for the Agreement stage.
  if (
    deal.status !==
    "Agreement Pending"
  ) {
    throw new AppError(
      `Agreement cannot be completed while the Deal is "${deal.status}".`,
      409,
    );
  }

  if (
    deal.agreementStatus !==
    "Pending"
  ) {
    throw new AppError(
      "The Agreement stage has already been completed.",
      409,
    );
  }

  // Record the Agreement completion.
  deal.agreementStatus =
    "Completed";

  deal.agreementCompletedAt =
    new Date();

  deal.agreementCompletedBy =
    user._id;

  // Move the Deal into the next real lifecycle stage.
  deal.status =
    "Agreement Completed";

  await deal.save();

  // Return the same fully populated Deal shape
  // used by the existing read endpoints.
  return populateDeal(
    Deal.findById(
      deal._id,
    ),
  );
};

// Cancel an active transaction Deal.
//
// Cancellation is allowed only before payment verification/finalization.
// The cancellation reason is stored for the transaction audit trail.
// If the Property is still Under Offer, it is returned to the marketplace
// as Published + Available.
const cancelDeal = async (
  user,
  dealId,
  cancellationReason,
) => {
  if (
    !dealId ||
    !mongoose.isValidObjectId(dealId)
  ) {
    throw new AppError(
      "Invalid Deal ID.",
      400,
    );
  }

  const accessFilter =
    await getDealAccessFilter(user);

  const deal = await Deal.findOne({
    _id: dealId,
    ...accessFilter,
  });

  if (!deal) {
    throw new AppError(
      "Deal not found.",
      404,
    );
  }

  const cancellableStatuses = new Set([
    "Agreement Pending",
    "Agreement Completed",
    "Payment Pending",
  ]);

  if (
    !cancellableStatuses.has(
      deal.status,
    )
  ) {
    throw new AppError(
      `Deal cannot be cancelled while the Deal is "${deal.status}".`,
      409,
    );
  }

  const reason =
    typeof cancellationReason ===
    "string"
      ? cancellationReason.trim()
      : "";

  if (!reason) {
    throw new AppError(
      "A cancellation reason is required.",
      400,
    );
  }

  if (reason.length > 2000) {
    throw new AppError(
      "Cancellation reason cannot exceed 2000 characters.",
      400,
    );
  }

  const property =
    await Property.findById(
      deal.property,
    );

  if (property) {
    /*
     * The accepted Offer moved the Property into
     * Under Offer. When the Deal is cancelled, make
     * the listing available again.
     */
    if (
      property.status ===
      "Under Offer"
    ) {
      property.status =
        "Published";

      property.availabilityStatus =
        "Available";

      await property.save();
    }
  }

  deal.status =
    "Cancelled";

  deal.cancelledAt =
    new Date();

  deal.cancelledBy =
    user._id;

  deal.cancellationReason =
    reason;

  await deal.save();

  return populateDeal(
    Deal.findById(
      deal._id,
    ),
  );
};

// Verify the payment for an Agreement-completed Deal.
//
// Payment verification belongs to Finance/Admin oversight.
// The Agent can monitor the Deal, but should not verify settlement.
//
// This function is intentionally idempotent. If an earlier version
// of the workflow already recorded paymentStatus = "Verified" but
// left the Deal status at "Payment Pending", this request repairs
// that state and moves it to "Payment Verified".
const verifyPayment = async (
  user,
  dealId,
) => {
  if (
    !dealId ||
    !mongoose.isValidObjectId(dealId)
  ) {
    throw new AppError(
      "Invalid Deal ID.",
      400,
    );
  }

  // Payment verification is restricted to Finance,
  // Admin and Super Admin.
  if (
    user?.role !== ROLES.FINANCE &&
    user?.role !== ROLES.ADMIN &&
    user?.role !== ROLES.SUPER_ADMIN
  ) {
    throw new AppError(
      "You are not authorized to verify Deal payment.",
      403,
    );
  }

  const deal = await Deal.findOne({
    _id: dealId,
  });

  if (!deal) {
    throw new AppError(
      "Deal not found.",
      404,
    );
  }

  /*
   * Idempotent recovery:
   *
   * The previous implementation already recorded
   * paymentStatus = "Verified" but stored the Deal status
   * incorrectly as "Payment Pending".
   *
   * Correct that state now.
   */
  if (
    deal.paymentStatus ===
    "Verified"
  ) {
    if (
      deal.status !==
      "Payment Verified"
    ) {
      deal.status =
        "Payment Verified";

      await deal.save();
    }

    return populateDeal(
      Deal.findById(
        deal._id,
      ),
    );
  }

  // Payment can only be verified after
  // the Agreement has been completed.
  if (
    deal.status !==
    "Agreement Completed"
  ) {
    throw new AppError(
      `Payment cannot be verified while the Deal is "${deal.status}".`,
      409,
    );
  }

  if (
    deal.agreementStatus !==
    "Completed"
  ) {
    throw new AppError(
      "The Agreement must be completed before payment can be verified.",
      409,
    );
  }

  // Record payment verification.
  deal.paymentStatus =
    "Verified";

  deal.paymentVerifiedAt =
    new Date();

  deal.paymentVerifiedBy =
    user._id;

  // Move the Deal to the correct
  // completion-ready lifecycle stage.
  deal.status =
    "Payment Verified";

  await deal.save();

  return populateDeal(
    Deal.findById(
      deal._id,
    ),
  );
};


// Complete a payment-verified Deal.
//
// Completion is the final transaction transition.
// It records who completed the Deal and moves the related
// Property from Under Offer to its final transaction state.
// Complete a payment-verified Deal.
//
// Completion is the final transaction transition.
// It records who completed the Deal, finalizes the Property,
// and automatically creates the Commission when the transaction
// belongs to an Agency/Agent.
const completeDeal = async (
  user,
  dealId,
) => {
  if (
    !dealId ||
    !mongoose.isValidObjectId(
      dealId,
    )
  ) {
    throw new AppError(
      "Invalid Deal ID.",
      400,
    );
  }

  // Only Finance, Admin and Super Admin can
  // finalize a transaction after payment verification.
  if (
    user?.role !== ROLES.FINANCE &&
    user?.role !== ROLES.ADMIN &&
    user?.role !== ROLES.SUPER_ADMIN
  ) {
    throw new AppError(
      "You are not authorized to complete this Deal.",
      403,
    );
  }

  const deal =
    await Deal.findById(
      dealId,
    );

  if (!deal) {
    throw new AppError(
      "Deal not found.",
      404,
    );
  }

  /*
   * Already-completed Deals are still passed through
   * the Commission hook so older completed Agency/Agent
   * Deals can be repaired if they do not yet have a
   * Commission record.
   */
  if (
    deal.status ===
    "Completed"
  ) {
    await createCommissionFromCompletedDeal(
      deal,
    );

    return populateDeal(
      Deal.findById(
        deal._id,
      ),
    );
  }

  // The Deal must have passed through payment verification
  // before it can become Completed.
  if (
    deal.status !==
    "Payment Verified"
  ) {
    throw new AppError(
      `Deal cannot be completed while the Deal is "${deal.status}".`,
      409,
    );
  }

  if (
    deal.paymentStatus !==
    "Verified"
  ) {
    throw new AppError(
      "Payment must be verified before the Deal can be completed.",
      409,
    );
  }

  if (
    deal.agreementStatus !==
    "Completed"
  ) {
    throw new AppError(
      "The Agreement must be completed before the Deal can be completed.",
      409,
    );
  }

  // Load the related Property.
  const property =
    await Property.findById(
      deal.property,
    );

  if (!property) {
    throw new AppError(
      "The Property associated with this Deal could not be found.",
      404,
    );
  }

  /*
   * Convert the transaction type into the final
   * Property lifecycle state.
   */
  const finalPropertyStatus =
    deal.transactionType ===
    "buy"
      ? "Sold"
      : deal.transactionType ===
        "rent"
        ? "Rented"
        : "Leased";

  /*
   * Keep the existing values so the transaction can be
   * restored if Commission creation fails.
   */
  const previousPropertyStatus =
    property.status;

  const previousPropertyAvailability =
    property.availabilityStatus;

  const previousDealStatus =
    deal.status;

  const previousCompletedAt =
    deal.completedAt;

  const previousCompletedBy =
    deal.completedBy;

  /*
   * Prepare the final transaction state in memory.
   */
  property.status =
    finalPropertyStatus;

  property.availabilityStatus =
    "Unavailable";

  deal.status =
    "Completed";

  deal.completedAt =
    new Date();

  deal.completedBy =
    user._id;

  try {
    /*
     * Persist the final Property and Deal state.
     */
    await property.save();

    await deal.save();

    /*
     * Automatically create the Commission.
     *
     * Agency/Agent transactions produce a Commission.
     * Admin/Super Admin platform-owned transactions
     * without Agency/Agent relationships return null.
     *
     * The Commission service is idempotent.
     */
    await createCommissionFromCompletedDeal(
      deal,
    );
  } catch (error) {
    /*
     * Restore the transaction state when Commission
     * creation fails.
     */
    property.status =
      previousPropertyStatus;

    property.availabilityStatus =
      previousPropertyAvailability;

    deal.status =
      previousDealStatus;

    deal.completedAt =
      previousCompletedAt;

    deal.completedBy =
      previousCompletedBy;

    await property.save();
    await deal.save();

    throw error;
  }

  /*
   * Return the fully populated Deal.
   */
  return populateDeal(
    Deal.findById(
      deal._id,
    ),
  );
};

// Export the Deal service methods.
module.exports = {
  getMyDeals,
  getDealById,
  completeAgreement,
  cancelDeal,
  verifyPayment,
  completeDeal,
};