// Import the Commission model used to store commission records.
const Commission = require("../models/commission.model");

// Import the Property model so we can validate finalized transactions.
const Property = require("../models/property.model");

// Import the Offer model so we can validate the accepted transaction offer.
const Offer = require("../models/offer.model");

// Import the Deal model because commissions are generated from completed Deals.
const Deal = require("../models/deal.model");

// Import the Agent model so commission percentages come from the real Agent profile.
const Agent = require("../models/agent.model");

// Import the Agency model so the authenticated Agency can be identified.
const Agency = require("../models/agency.model");

// Import the application error helper.
const AppError = require("../utils/AppError");

// Luxora's current platform commission rate.
//
// The commission is calculated from the finalized Deal value,
// not from a Property field entered by the Agent or Owner.
const COMMISSION_RATE = 0.05;

// Generate a readable commission reference.
const generateCommissionId = () => {
  // Use the current timestamp plus a random suffix to avoid collisions.
  const timestamp = Date.now().toString().slice(-8);
  const suffix = Math.floor(100 + Math.random() * 900);

  return `COM-${timestamp}-${suffix}`;
};

// Find the Agency profile represented by the authenticated Agency user.
const getAuthenticatedAgency = async (userId) => {
  // The Agency user is linked to exactly one Agency profile.
  const agency = await Agency.findOne({
    user: userId,
    status: "Active",
  });

  // Stop when the authenticated Agency does not have an active profile.
  if (!agency) {
    throw new AppError(
      "No active agency profile found for this account",
      404,
    );
  }

  return agency;
};

// Create a Commission directly from a completed Deal.
//
// This is the internal transaction hook used by the Deal domain.
// It does not depend on an authenticated Agency user because
// Deal completion may be performed by Finance/Admin/Super Admin.
//
// Admin/Super Admin-created listings without an Agency/Agent
// do not generate Agency commission records.
const createCommissionFromCompletedDeal = async (deal) => {
  // A valid Deal is required.
  if (!deal?._id) {
    throw new AppError(
      "A valid Deal is required to create a Commission.",
      400,
    );
  }

  // Commission creation is only valid after Deal completion.
  if (deal.status !== "Completed") {
    throw new AppError(
      "Commission can only be created from a completed Deal.",
      409,
    );
  }

  // Every completed Deal must reference a Property.
  if (!deal.property) {
    throw new AppError(
      "The completed Deal is missing its Property.",
      500,
    );
  }

  /*
   * Platform-owned Admin/Super Admin transactions may have
   * no Agency or Agent.
   *
   * Those transactions finalize successfully but do not create
   * Agency commission records.
   */
  if (!deal.agency || !deal.agent) {
    return null;
  }

  // Prevent duplicate Commission creation for the same Deal.
  const existingCommission = await Commission.findOne({
    deal: deal._id,
  });

  if (existingCommission) {
    return existingCommission;
  }

  // Load the finalized Property.
  const property = await Property.findById(deal.property);

  if (!property) {
    throw new AppError(
      "The Property associated with the completed Deal could not be found.",
      404,
    );
  }

  // Load the Agent responsible for the completed transaction.
  const agent = await Agent.findById(deal.agent);

  if (!agent) {
    throw new AppError(
      "The Agent associated with the completed Deal could not be found.",
      404,
    );
  }

  // Confirm the Agent belongs to the Deal's Agency.
  if (String(agent.agency) !== String(deal.agency)) {
    throw new AppError(
      "The Deal Agent does not belong to the Deal Agency.",
      409,
    );
  }

  // The Deal's agreed amount is the authoritative transaction value.
  const dealValue = Number(deal.agreedAmount || 0);

  if (dealValue <= 0) {
    throw new AppError(
      "The completed Deal does not contain a valid agreed amount.",
      400,
    );
  }

  // Calculate the Luxora commission pool from the finalized Deal value.
  //
  // Example:
  // ₦49,000,000 × 5% = ₦2,450,000 commission pool.
  const commissionPool = dealValue * COMMISSION_RATE;

  // Read the Agent's configured commission split.
  const agentSharePercent = Number(agent.agentShare || 0);
  const agencySharePercent = Number(agent.agencyShare || 0);

  // The Agent and Agency shares must always total 100%.
  if (
    agentSharePercent < 0 ||
    agencySharePercent < 0 ||
    agentSharePercent + agencySharePercent !== 100
  ) {
    throw new AppError(
      "Agent and Agency commission shares must total 100%.",
      400,
    );
  }

  // Calculate the Agent and Agency portions of the commission pool.
  const agentAmount =
    commissionPool * (agentSharePercent / 100);

  const agencyAmount =
    commissionPool * (agencySharePercent / 100);

  // Create the immutable Commission snapshot.
  return Commission.create({
    commissionId: generateCommissionId(),

    agency: deal.agency,

    agent: deal.agent,

    property: property._id,

    offer: deal.offer,

    deal: deal._id,

    // Store the finalized Deal value.
    dealValue,

    // Store the calculated Luxora commission pool.
    commissionPool,

    agentSharePercent,

    agencySharePercent,

    agentAmount,

    agencyAmount,

    status: "Pending",
  });
};

// Generate one commission from a finalized transaction.
//
// This remains available for an authenticated Agency as a manual
// repair/reconciliation endpoint, but it now uses the exact same
// business logic as automatic Deal completion.
const generateCommission = async (userId, propertyId, offerId) => {
  // Identify the Agency making the request.
  const agency = await getAuthenticatedAgency(userId);

  // Find the Property and ensure it belongs to this Agency.
  const property = await Property.findOne({
    _id: propertyId,
    agency: agency._id,
  });

  if (!property) {
    throw new AppError(
      "Property not found or does not belong to this agency",
      404,
    );
  }

  // Commission generation is only allowed for finalized
  // property transaction states.
  const finalizedStatuses = ["Sold", "Rented", "Leased"];

  if (!finalizedStatuses.includes(property.status)) {
    throw new AppError(
      "Commission can only be generated for a Sold, Rented, or Leased property",
      400,
    );
  }

  // Find the accepted Offer attached to the Property.
  const offer = await Offer.findOne({
    _id: offerId,
    property: property._id,
    status: "Accepted",
  });

  if (!offer) {
    throw new AppError(
      "An accepted offer for this property is required",
      400,
    );
  }

  // Find the completed Deal created from that accepted Offer.
  const deal = await Deal.findOne({
    property: property._id,
    offer: offer._id,
    status: "Completed",
  });

  if (!deal) {
    throw new AppError(
      "A completed Deal is required before commission can be generated",
      400,
    );
  }

  /*
   * Important:
   *
   * Do not calculate commission here separately.
   *
   * Delegate to the same internal function used by
   * Deal completion so automatic and manual commission
   * generation always follow exactly the same rules.
   */
  return createCommissionFromCompletedDeal(deal);
};

// Get all commission records belonging to the authenticated Agency.
const getAgencyCommissions = async (userId) => {
  // Identify the Agency represented by the logged-in user.
  const agency = await getAuthenticatedAgency(userId);

  // Retrieve only commissions belonging to this Agency.
  return Commission.find({
    agency: agency._id,
  })
    .populate({
      path: "agent",
      select: "fullName email agentShare agencyShare commissionModel",
    })
    .populate({
      path: "property",
      select: "title status transactionType price agencyFee",
    })
    .populate({
      path: "offer",
      select: "offerAmount status buyer",
      populate: {
        path: "buyer",
        select: "fullName email",
      },
    })
    .populate({
      path: "deal",
      select:
        "dealId property offer buyer owner agency agent transactionType agreedAmount status agreementStatus paymentStatus agreementCompletedAt paymentVerifiedAt completedAt cancelledAt",
    })
    .sort({
      createdAt: -1,
    });
};

// Calculate real Agency commission summary statistics.
const getAgencyCommissionSummary = async (userId) => {
  // Identify the Agency represented by the logged-in user.
  const agency = await getAuthenticatedAgency(userId);

  // Aggregate commissions by payment status.
  const result = await Commission.aggregate([
    {
      $match: {
        agency: agency._id,
      },
    },
    {
      $group: {
        _id: "$status",
        total: {
          $sum: "$agencyAmount",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  // Start with zero values for statuses that have no records.
  const summary = {
    paid: {
      amount: 0,
      count: 0,
    },
    pending: {
      amount: 0,
      count: 0,
    },
    processing: {
      amount: 0,
      count: 0,
    },
    overdue: {
      amount: 0,
      count: 0,
    },
    cancelled: {
      amount: 0,
      count: 0,
    },
  };

  // Map MongoDB aggregation results into the API response shape.
  result.forEach((item) => {
    const key = item._id.toLowerCase();

    if (summary[key]) {
      summary[key] = {
        amount: item.total,
        count: item.count,
      };
    }
  });

  // Return the Agency's actual commission statistics.
  return summary;
};

// Update one Agency commission through the supported payment lifecycle.
const updateAgencyCommissionStatus = async (
  userId,
  commissionId,
  nextStatus,
) => {
  // Identify the Agency represented by the authenticated User.
  const agency = await getAuthenticatedAgency(userId);

  /*
   * commissionId is the public Luxora commission reference
   * displayed by the Agency dashboard, for example:
   *
   * COM-55409336-460
   *
   * Use that public identifier for API mutations rather
   * than exposing MongoDB's internal _id.
   */
  const commission = await Commission.findOne({
    commissionId,
    agency: agency._id,
  });

  // Prevent an Agency from updating a commission it does not own.
  if (!commission) {
    throw new AppError("Commission not found", 404);
  }

  // Define the only allowed lifecycle transitions.
  const allowedTransitions = {
    Pending: ["Processing", "Cancelled"],
    Processing: ["Paid", "Cancelled"],
    Paid: [],
    Overdue: ["Processing", "Cancelled"],
    Cancelled: [],
  };

  // Read the valid next states for the commission's current status.
  const allowedNextStatuses =
    allowedTransitions[commission.status] || [];

  // Prevent arbitrary status manipulation.
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new AppError(
      `Commission cannot move from ${commission.status} to ${nextStatus}`,
      400,
    );
  }

  // Update the commission status.
  commission.status = nextStatus;

  // Record the actual internal payment date when the commission becomes Paid.
  if (nextStatus === "Paid") {
    commission.paidAt = new Date();
  }

  // Clear a previous paid date if a future workflow allows
  // a record to move away from Paid.
  if (nextStatus !== "Paid" && commission.paidAt) {
    commission.paidAt = null;
  }

  // Save the lifecycle change.
  await commission.save();

  // Return the updated commission with its related data populated.
  return Commission.findById(commission._id)
    .populate({
      path: "agent",
      select: "fullName email agentShare agencyShare commissionModel",
    })
    .populate({
      path: "property",
      select: "title status transactionType price agencyFee",
    })
    .populate({
      path: "offer",
      select: "offerAmount counterOfferAmount status buyer",
      populate: {
        path: "buyer",
        select: "fullName email",
      },
    })
    .populate({
      path: "deal",
      select:
        "dealId property offer buyer owner agency agent transactionType agreedAmount status agreementStatus paymentStatus agreementCompletedAt paymentVerifiedAt completedAt cancelledAt",
    });
};

// Run the Agency payroll operation against commissions already in Processing.
const runAgencyPayroll = async (userId) => {
  // Identify the authenticated Agency.
  const agency = await getAuthenticatedAgency(userId);

  // Find only commissions currently in Processing for this Agency.
  const processingCommissions = await Commission.find({
    agency: agency._id,
    status: "Processing",
  });

  // Return a clean result when there is nothing to pay internally.
  if (processingCommissions.length === 0) {
    return {
      processedCount: 0,
      totalPaid: 0,
      commissions: [],
    };
  }

  // Mark each processing commission as Paid in the internal ledger.
  const paidAt = new Date();

  processingCommissions.forEach((commission) => {
    commission.status = "Paid";
    commission.paidAt = paidAt;
  });

  // Persist the payroll status changes.
  await Commission.bulkSave(processingCommissions);

  // Calculate the total Agency amount marked as Paid.
  const totalPaid = processingCommissions.reduce(
    (total, commission) =>
      total + Number(commission.agencyAmount || 0),
    0,
  );

  // Return the processed commission references and total.
  return {
    processedCount: processingCommissions.length,
    totalPaid,
    commissions: processingCommissions,
  };
};

// Find the Agent profile represented by the authenticated Agent user.
const getAuthenticatedAgent = async (userId) => {
  // Locate the Agent profile linked to the logged-in User.
  const agent = await Agent.findOne({
    user: userId,
  });

  // Stop when no Agent profile exists for this account.
  if (!agent) {
    throw new AppError(
      "No agent profile found for this account",
      404,
    );
  }

  return agent;
};

// Get all commission records belonging to the authenticated Agent.
const getAgentCommissions = async (userId) => {
  // Identify the Agent represented by the logged-in user.
  const agent = await getAuthenticatedAgent(userId);

  // Retrieve only commissions assigned to this Agent.
  return Commission.find({
    agent: agent._id,
  })
    .populate({
      path: "agency",
      select: "name status",
    })
    .populate({
      path: "property",
      select: "title status transactionType price agencyFee",
    })
    .populate({
      path: "offer",
      select:
        "offerAmount counterOfferAmount status buyer createdAt updatedAt",
      populate: {
        path: "buyer",
        select: "fullName email phone",
      },
    })
    .populate({
      path: "deal",
      select:
        "dealId property offer buyer owner agency agent transactionType agreedAmount status agreementStatus paymentStatus agreementCompletedAt paymentVerifiedAt completedAt cancelledAt",
    })
    .sort({
      createdAt: -1,
    });
};

// Calculate real Agent commission summary statistics.
const getAgentCommissionSummary = async (userId) => {
  // Identify the Agent represented by the logged-in user.
  const agent = await getAuthenticatedAgent(userId);

  // Aggregate the Agent's commission earnings by payment status.
  const result = await Commission.aggregate([
    {
      $match: {
        agent: agent._id,
      },
    },
    {
      $group: {
        _id: "$status",
        total: {
          $sum: "$agentAmount",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  // Start all supported statuses at zero.
  const summary = {
    paid: {
      amount: 0,
      count: 0,
    },
    pending: {
      amount: 0,
      count: 0,
    },
    processing: {
      amount: 0,
      count: 0,
    },
    overdue: {
      amount: 0,
      count: 0,
    },
    cancelled: {
      amount: 0,
      count: 0,
    },
  };

  // Map aggregation results into the response object.
  result.forEach((item) => {
    const key = item._id.toLowerCase();

    if (summary[key]) {
      summary[key] = {
        amount: item.total,
        count: item.count,
      };
    }
  });

  // Calculate the Agent's complete ledger totals.
  const totals = await Commission.aggregate([
    {
      $match: {
        agent: agent._id,
      },
    },
    {
      $group: {
        _id: null,
        totalEarned: {
          $sum: "$agentAmount",
        },
        totalCommissionPool: {
          $sum: "$commissionPool",
        },
        totalDeals: {
          $sum: 1,
        },
      },
    },
  ]);

  const overall = totals[0] || {
    totalEarned: 0,
    totalCommissionPool: 0,
    totalDeals: 0,
  };

  return {
    ...summary,
    totalEarned: overall.totalEarned,
    totalCommissionPool: overall.totalCommissionPool,
    totalDeals: overall.totalDeals,
  };
};

module.exports = {
  createCommissionFromCompletedDeal,
  generateCommission,
  getAgencyCommissions,
  getAgencyCommissionSummary,
  updateAgencyCommissionStatus,
  runAgencyPayroll,
  getAgentCommissions,
  getAgentCommissionSummary,
};