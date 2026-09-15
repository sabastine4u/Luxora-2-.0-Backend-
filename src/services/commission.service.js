// Import the Commission model used to store Agency commission records.
const Commission = require("../models/commission.model");

// Import the Property model so we can validate finalized transactions.
const Property = require("../models/property.model");

// Import the Offer model so we can validate the accepted transaction offer.
const Offer = require("../models/offer.model");

// Import the Agent model so commission percentages come from the real Agent profile.
const Agent = require("../models/agent.model");

// Import the Agency model so the authenticated Agency can be identified.
const Agency = require("../models/agency.model");

// Import the application error helper.
const AppError = require("../utils/AppError");

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

// Generate one commission from a finalized Property transaction.
const generateCommission = async (userId, propertyId, offerId) => {
  // Identify the Agency making the request.
  const agency = await getAuthenticatedAgency(userId);

  // Find the Property and ensure it belongs to this Agency.
  const property = await Property.findOne({
    _id: propertyId,
    agency: agency._id,
  });

  // Stop when the Property does not belong to the authenticated Agency.
  if (!property) {
    throw new AppError(
      "Property not found or does not belong to this agency",
      404,
    );
  }

  // Commission generation is only allowed for completed transaction states.
  const finalizedStatuses = ["Sold", "Rented", "Leased"];

  if (!finalizedStatuses.includes(property.status)) {
    throw new AppError(
      "Commission can only be generated for a Sold, Rented, or Leased property",
      400,
    );
  }

  // Find the Offer attached to the Property.
  const offer = await Offer.findOne({
    _id: offerId,
    property: property._id,
    status: "Accepted",
  });

  // A commission must originate from a real accepted Offer.
  if (!offer) {
    throw new AppError(
      "An accepted offer for this property is required",
      400,
    );
  }

  // The finalized Property must have an Agent responsible for the transaction.
  if (!property.agent) {
    throw new AppError(
      "This property does not have an assigned agent",
      400,
    );
  }

  // Retrieve the Agent's current commission configuration.
  const agent = await Agent.findById(property.agent);

  if (!agent) {
    throw new AppError(
      "Assigned agent profile could not be found",
      404,
    );
  }

  // Make sure the Agent actually belongs to this Agency.
  if (String(agent.agency) !== String(agency._id)) {
    throw new AppError(
      "Assigned agent does not belong to this agency",
      403,
    );
  }

  // The Property's agency fee is the commission pool.
  const commissionPool = Number(property.agencyFee || 0);

  // A commission cannot be generated without a defined agency fee.
  if (commissionPool <= 0) {
    throw new AppError(
      "This property does not have a valid agency fee",
      400,
    );
  }

  // Read the Agent's configured split percentages.
  const agentSharePercent = Number(agent.agentShare || 0);
  const agencySharePercent = Number(agent.agencyShare || 0);

  // Both percentages must form a valid split.
  if (
    agentSharePercent < 0 ||
    agencySharePercent < 0 ||
    agentSharePercent + agencySharePercent !== 100
  ) {
    throw new AppError(
      "Agent and agency commission shares must total 100%",
      400,
    );
  }

  // Prevent duplicate commissions for the same accepted Offer.
  const existingCommission = await Commission.findOne({
    offer: offer._id,
  });

  if (existingCommission) {
    return existingCommission;
  }

  // Calculate the Agent's and Agency's portions of the commission pool.
  const agentAmount =
    commissionPool * (agentSharePercent / 100);

  const agencyAmount =
    commissionPool * (agencySharePercent / 100);

  // Create and store the immutable commission snapshot.
  const commission = await Commission.create({
    commissionId: generateCommissionId(),
    agency: agency._id,
    agent: agent._id,
    property: property._id,
    offer: offer._id,
    dealValue: Number(offer.offerAmount || 0),
    commissionPool,
    agentSharePercent,
    agencySharePercent,
    agentAmount,
    agencyAmount,
    status: "Pending",
  });

  // Return the newly created commission.
  return commission;
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

  // Find the commission only when it belongs to this Agency.
  const commission = await Commission.findOne({
    _id: commissionId,
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

  // Clear a previous paid date if a future workflow allows a record
  // to move away from Paid. Currently Paid is terminal, so this is defensive.
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
      select: "offerAmount status buyer",
      populate: {
        path: "buyer",
        select: "fullName email",
      },
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
      select:
        "title status transactionType price agencyFee",
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
  generateCommission,
  getAgencyCommissions,
  getAgencyCommissionSummary,
  updateAgencyCommissionStatus,
  runAgencyPayroll,
  getAgentCommissions,
  getAgentCommissionSummary,
};