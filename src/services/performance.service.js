// Import the Property model for Agency listing and transaction data.
const Property = require("../models/property.model");

// Import the Agency model so the authenticated Agency can be identified.
const Agency = require("../models/agency.model");

// Import the Agent model for the Agency leaderboard.
const Agent = require("../models/agent.model");

// Import the Inquiry model for the Agency lead funnel.
const Inquiry = require("../models/inquiry.model");

// Import the Booking model for real viewing-request counts.
const Booking = require("../models/booking.model");

// Import the Offer model for real Agency offer counts and deal values.
const Offer = require("../models/offer.model");

// Import the Commission model for finalized transactions and monthly trends.
const Commission = require("../models/commission.model");

const Favorite = require("../models/favorite.model");
const PropertyView = require("../models/property-view.model");

// Import AppError for controlled business-rule failures.
const AppError = require("../utils/AppError");

// Identify the active Agency represented by the authenticated User.
const getAuthenticatedAgency = async (userId) => {
  // Find the Agency profile linked to the current login.
  const agency = await Agency.findOne({
    user: userId,
    status: "Active",
  }).select("_id name status");

  // Stop when the User does not have an active Agency profile.
  if (!agency) {
    throw new AppError("No active agency profile found for this account", 404);
  }

  return agency;
};

// Build the Agency Performance dashboard from real related records.
const getAgencyPerformance = async (userId) => {
  // Identify the authenticated Agency.
  const agency = await getAuthenticatedAgency(userId);

  // Define the current calendar year's start.
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

  // Get all Properties belonging to this Agency.
  const agencyProperties = await Property.find({
    agency: agency._id,
  }).select(
    "_id title propertyType status transactionType price agent updatedAt",
  );

  // Create a list of Property IDs for relationship-based queries.
  const propertyIds = agencyProperties.map((property) => property._id);

  // Define the finalized Property states that represent completed transactions.
  const finalizedStatuses = ["Sold", "Rented", "Leased"];

  // Identify the Agency's finalized transactions.
  const finalizedProperties = agencyProperties.filter((property) =>
    finalizedStatuses.includes(property.status),
  );

  // Count all Agency inquiries using the Inquiry's direct Agency relationship.
  const inquiryCount = await Inquiry.countDocuments({
    agency: agency._id,
  });

  // Count viewing requests through Properties assigned to this Agency.
  const viewingCount =
    propertyIds.length > 0
      ? await Booking.countDocuments({
          property: {
            $in: propertyIds,
          },
        })
      : 0;

  // Count offers through the Offer's direct Agency relationship.
  const offerCount = await Offer.countDocuments({
    agency: agency._id,
  });

  // Retrieve accepted offers for the Agency.
  const acceptedOffers = await Offer.find({
    agency: agency._id,
    status: "Accepted",
  }).select("_id property agent offerAmount createdAt updatedAt");

  // Keep accepted offers whose Property is actually finalized.
  const completedOffers = acceptedOffers.filter((offer) => {
    const property = agencyProperties.find(
      (item) => String(item._id) === String(offer.property),
    );

    return property && finalizedStatuses.includes(property.status);
  });

  // Calculate closed transaction value from real accepted offers.
  const closedDealValue = completedOffers.reduce(
    (total, offer) => total + Number(offer.offerAmount || 0),
    0,
  );

  // Calculate the current listing-to-deal conversion.
  const listingConversion =
    agencyProperties.length > 0
      ? (finalizedProperties.length / agencyProperties.length) * 100
      : null;

  // Build the real Agency Performance funnel.
  // Overall conversion is measured from submitted offers to finalized deals,
  // because those two values represent the closest comparable transaction stage.
  const funnel = {
    inquiries: inquiryCount,
    viewings: viewingCount,
    offers: offerCount,
    closedDeals: finalizedProperties.length,

    // Calculate the Offer -> Closed Deal conversion.
    conversionRate:
      offerCount > 0
        ? Number(((finalizedProperties.length / offerCount) * 100).toFixed(1))
        : null,
  };

  // Aggregate finalized transaction values by Property type.
  const distributionMap = {};

  completedOffers.forEach((offer) => {
    const property = agencyProperties.find(
      (item) => String(item._id) === String(offer.property),
    );

    const type = property?.propertyType || "Other";

    if (!distributionMap[type]) {
      distributionMap[type] = 0;
    }

    distributionMap[type] += Number(offer.offerAmount || 0);
  });

  // Convert the distribution object into dashboard-friendly records.
  const revenueDistribution = Object.entries(distributionMap)
    .map(([label, value]) => ({
      label,
      value,
      percentage: closedDealValue > 0 ? (value / closedDealValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Get the Agency's Agent profiles.
  const agents = await Agent.find({
    agency: agency._id,
  }).select("_id fullName department level status");

  // Build real leaderboard values from finalized transactions.
  const leaderboardMap = {};

  completedOffers.forEach((offer) => {
    const agentId = offer.agent ? String(offer.agent) : null;

    if (!agentId) return;

    if (!leaderboardMap[agentId]) {
      leaderboardMap[agentId] = {
        closedDeals: 0,
        dealValue: 0,
      };
    }

    leaderboardMap[agentId].closedDeals += 1;

    leaderboardMap[agentId].dealValue += Number(offer.offerAmount || 0);
  });

  // Combine every Agency Agent with their actual transaction performance.
  const agentLeaderboard = agents
    .map((agent) => {
      const stats = leaderboardMap[String(agent._id)] || {
        closedDeals: 0,
        dealValue: 0,
      };

      return {
        id: agent._id,
        name: agent.fullName,
        department: agent.department || null,
        level: agent.level || null,
        status: agent.status,
        closedDeals: stats.closedDeals,
        dealValue: stats.dealValue,
        // Performance score is intentionally unavailable.
        performanceScore: null,
        // Historical trend is intentionally unavailable.
        trend: null,
      };
    })
    .sort((a, b) => {
      // Rank primarily by actual closed transaction value.
      if (b.dealValue !== a.dealValue) {
        return b.dealValue - a.dealValue;
      }

      // Use closed deal count as the secondary ranking.
      return b.closedDeals - a.closedDeals;
    });

  // Build the previous 12 calendar months for the real earnings trend.
  const now = new Date();

  const monthlyTrend = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);

    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);

    const monthlyOffers = await Offer.find({
      agency: agency._id,
      status: "Accepted",
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }).select("property offerAmount");

    // Only count accepted offers whose property is finalized.
    const monthlyClosedOffers = monthlyOffers.filter((offer) => {
      const property = agencyProperties.find(
        (item) => String(item._id) === String(offer.property),
      );

      return property && finalizedStatuses.includes(property.status);
    });

    const value = monthlyClosedOffers.reduce(
      (total, offer) => total + Number(offer.offerAmount || 0),
      0,
    );

    monthlyTrend.push({
      month: start.toLocaleString("en-NG", {
        month: "short",
      }),
      year: start.getFullYear(),
      value,
    });
  }

  // Pull finalized commission records for recent conversion activity.
  const recentConversions = await Commission.find({
    agency: agency._id,
  })
    .populate({
      path: "agent",
      select: "fullName",
    })
    .populate({
      path: "property",
      select: "title",
    })
    .sort({
      createdAt: -1,
    })
    .limit(10);

  // Return the complete real Agency Performance payload.
  return {
    summary: {
      // Deal value is used instead of calling transaction value "revenue".
      closedDealValue,
      closedDeals: finalizedProperties.length,
      listingConversion:
        listingConversion == null ? null : Number(listingConversion.toFixed(1)),
      // These metrics require historical/market datasets not currently stored.
      growthRate: null,
      marketShare: null,
    },

    funnel,

    revenueDistribution,

    monthlyTrend,

    agentLeaderboard,

    recentConversions: recentConversions.map((commission) => ({
      id: commission.commissionId,
      date: commission.createdAt,
      amount: commission.agencyAmount,
      status: commission.status,
      agent: commission.agent?.fullName || "Unassigned",
      property: commission.property?.title || "—",
      dealValue: commission.dealValue,
    })),

    // Department cost/ROI tracking is not currently supported.
    departmentRoi: [],
  };
};

// Build the Performance dashboard for the authenticated Agent.
const getAgentPerformance = async (userId) => {
  // Find the Agent profile connected to the logged-in User.
  const agent = await Agent.findOne({
    user: userId,
  }).select("_id agency fullName status");

  if (!agent) {
    throw new AppError("Agent profile not found for this account", 404);
  }

  if (agent.status !== "Active") {
    throw new AppError("Only active Agents can access performance data", 403);
  }

  // Load the Agent's accepted listings.
  const listings = await Property.find({
    agent: agent._id,
    assignmentStatus: "Agent Accepted",
  }).select(
    "_id title status propertyType transactionType price updatedAt createdAt",
  );

  const listingIds = listings.map((property) => property._id);

  // Load the Agent's real Lead pipeline.
  const inquiries = await Inquiry.find({
    agent: agent._id,
  }).select("_id status createdAt firstContactedAt");

  // Load the Agent's real Offers / Deals.
  const offers = await Offer.find({
    agent: agent._id,
  }).select(
    "_id property status offerAmount counterOfferAmount createdAt updatedAt",
  );

  // Load the Agent's real commission records.
  const commissions = await Commission.find({
    agent: agent._id,
  }).select("_id property agentAmount commissionPool status createdAt");

  const finalizedStatuses = ["Sold", "Rented", "Leased"];

  // Accepted Offers only become closed deals when the Property
  // itself has reached a finalized transaction state.
  const closedOffers = offers.filter((offer) => {
    const property = listings.find(
      (item) => String(item._id) === String(offer.property),
    );

    return (
      offer.status === "Accepted" &&
      property &&
      finalizedStatuses.includes(property.status)
    );
  });

  // Active deal pipeline.
  const activeDeals = offers.filter((offer) =>
    [
      "Submitted",
      "Under Review",
      "Counter Offer Received",
      "Accepted",
    ].includes(offer.status),
  );

  // Calculate the actual closed transaction value.
  const totalRevenue = closedOffers.reduce(
    (total, offer) =>
      total + Number(offer.counterOfferAmount ?? offer.offerAmount ?? 0),
    0,
  );

  // Current month boundaries.
  const now = new Date();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Current and previous commission totals.
  const currentMonthCommission = commissions
    .filter(
      (commission) =>
        commission.createdAt >= currentMonthStart &&
        commission.createdAt < nextMonthStart,
    )
    .reduce(
      (total, commission) => total + Number(commission.agentAmount || 0),
      0,
    );

  const previousMonthCommission = commissions
    .filter(
      (commission) =>
        commission.createdAt >= previousMonthStart &&
        commission.createdAt < currentMonthStart,
    )
    .reduce(
      (total, commission) => total + Number(commission.agentAmount || 0),
      0,
    );

  // Year-to-date commission.
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const ytdCommission = commissions
    .filter((commission) => commission.createdAt >= yearStart)
    .reduce(
      (total, commission) => total + Number(commission.agentAmount || 0),
      0,
    );

  // Pending commission.
  const pendingCommission = commissions
    .filter((commission) =>
      ["Pending", "Processing", "Overdue"].includes(commission.status),
    )
    .reduce(
      (total, commission) => total + Number(commission.agentAmount || 0),
      0,
    );

  // Lead conversion.
  const closedLeads = inquiries.filter(
    (inquiry) => inquiry.status === "Closed",
  ).length;

  const conversionRate =
    inquiries.length > 0
      ? Number(((closedLeads / inquiries.length) * 100).toFixed(1))
      : null;

  // Viewing / appointment counts are derived from scheduled inquiries.
  const scheduledViewings = await Inquiry.countDocuments({
    agent: agent._id,
    scheduledDate: { $ne: null },
    scheduledTime: { $ne: null },
  });

  const completedViewings = await Inquiry.countDocuments({
    agent: agent._id,
    appointmentStatus: "Completed",
  });

  // Productivity data that the backend can actually support.
  const currentMonthListings = listings.filter(
    (property) =>
      property.createdAt >= currentMonthStart &&
      property.createdAt < nextMonthStart,
  ).length;

  const responseTimeRecords = inquiries
    .filter((inquiry) => inquiry.createdAt && inquiry.firstContactedAt)
    .map((inquiry) => {
      const createdAt = new Date(inquiry.createdAt);
      const firstContactedAt = new Date(inquiry.firstContactedAt);

      const responseMinutes = Math.round(
        (firstContactedAt.getTime() - createdAt.getTime()) / 60000,
      );

      return {
        inquiryId: inquiry._id,
        createdAt,
        firstContactedAt,
        responseMinutes,
      };
    })
    .filter((record) => record.responseMinutes >= 0);

  const responseTimes = responseTimeRecords.map(
    (record) => record.responseMinutes,
  );

  const averageResponseMinutes =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, value) => sum + value, 0) /
            responseTimes.length,
        )
      : null;

  // Build the 6-month revenue / commission trend.
  const monthlyTrend = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);

    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);

    const monthlyClosedOffers = closedOffers.filter(
      (offer) => offer.createdAt >= start && offer.createdAt < end,
    );

    const revenue = monthlyClosedOffers.reduce(
      (total, offer) =>
        total + Number(offer.counterOfferAmount ?? offer.offerAmount ?? 0),
      0,
    );

    const commission = commissions
      .filter((item) => item.createdAt >= start && item.createdAt < end)
      .reduce((total, item) => total + Number(item.agentAmount || 0), 0);

    monthlyTrend.push({
      month: start.toLocaleString("en-NG", {
        month: "short",
      }),
      year: start.getFullYear(),
      revenue,
      commission,
    });
  }

  // Build the actual agency leaderboard.
  const agencyAgents = await Agent.find({
    agency: agent.agency,
  }).select("_id fullName status");

  const agencyAgentIds = agencyAgents.map((item) => item._id);

  const agencyOffers = await Offer.find({
    agent: { $in: agencyAgentIds },
    status: "Accepted",
  }).select("_id agent property offerAmount counterOfferAmount");

  const leaderboard = agencyAgents
    .map((agencyAgent) => {
      const agentOffers = agencyOffers.filter(
        (offer) => String(offer.agent) === String(agencyAgent._id),
      );

      const closedAgentOffers = agentOffers.filter((offer) => {
        const property = listings.find(
          (item) => String(item._id) === String(offer.property),
        );

        return property && finalizedStatuses.includes(property.status);
      });

      const dealValue = closedAgentOffers.reduce(
        (total, offer) =>
          total + Number(offer.counterOfferAmount ?? offer.offerAmount ?? 0),
        0,
      );

      return {
        id: agencyAgent._id,
        name: agencyAgent.fullName,
        closedDeals: closedAgentOffers.length,
        dealValue,
      };
    })
    .sort((a, b) => b.dealValue - a.dealValue || b.closedDeals - a.closedDeals);

  const myRank =
    leaderboard.findIndex((item) => String(item.id) === String(agent._id)) + 1;

  // Real property-performance data.
  const propertyViewCounts =
    listingIds.length > 0
      ? await PropertyView.aggregate([
          {
            $match: {
              property: {
                $in: listingIds,
              },
            },
          },
          {
            $group: {
              _id: "$property",
              views: { $sum: 1 },
            },
          },
        ])
      : [];

  const propertyFavoriteCounts =
    listingIds.length > 0
      ? await Favorite.aggregate([
          {
            $match: {
              property: {
                $in: listingIds,
              },
            },
          },
          {
            $group: {
              _id: "$property",
              favorites: { $sum: 1 },
            },
          },
        ])
      : [];

  const topPerformingProperties = listings
    .map((property) => {
      const propertyOffers = offers.filter(
        (offer) => String(offer.property) === String(property._id),
      );

      const acceptedPropertyOffers = closedOffers.filter(
        (offer) => String(offer.property) === String(property._id),
      );

      const viewRecord = propertyViewCounts.find(
        (item) => String(item._id) === String(property._id),
      );

      const favoriteRecord = propertyFavoriteCounts.find(
        (item) => String(item._id) === String(property._id),
      );

      const revenue = acceptedPropertyOffers.reduce(
        (total, offer) =>
          total + Number(offer.counterOfferAmount ?? offer.offerAmount ?? 0),
        0,
      );

      return {
        id: property._id,
        name: property.title,
        views: viewRecord?.views || 0,
        favorites: favoriteRecord?.favorites || 0,
        offers: propertyOffers.length,
        status: property.status,
        revenue,
      };
    })
    .sort(
      (a, b) =>
        b.views - a.views || b.favorites - a.favorites || b.offers - a.offers,
    )
    .slice(0, 5);

  return {
    summary: {
      closedDeals: closedOffers.length,
      activeDeals: activeDeals.length,
      totalRevenue,
      monthlyCommission: currentMonthCommission,
      previousMonthCommission,
      ytdCommission,
      pendingCommission,
      conversionRate,
      // CSAT is not stored in the current backend.
      csatScore: null,
    },

    salesTarget: {
      // No agent sales-target field currently exists.
      currentProgress: totalRevenue,
      monthlyTarget: null,
      remaining: null,
      completionPercentage: null,
      pendingDealValue: activeDeals.reduce(
        (total, offer) =>
          total + Number(offer.counterOfferAmount ?? offer.offerAmount ?? 0),
        0,
      ),
      projectedValue: null,
    },

    monthlyTrend,

    funnel: {
      newLeads: inquiries.filter((item) => item.status === "New").length,
      contactedLeads: inquiries.filter((item) => item.status === "Contacted")
        .length,
      viewingScheduled: scheduledViewings,
      offers: offers.length,
      closedDeals: closedOffers.length,
    },

    productivity: {
      appointmentsCompleted: completedViewings,
      callsMade: null,
      messagesSent: null,
      listingsAdded: currentMonthListings,
      averageResponseMinutes,
    },

    satisfaction: {
      score: null,
      completedReviews: 0,
      positiveFeedback: null,
      repeatClients: null,
    },

    leaderboard: {
      rank: myRank > 0 ? myRank : null,
      totalAgents: leaderboard.length,
      rows: leaderboard,
    },

    topPerformingProperties,

    commissionOverview: {
      currentMonth: currentMonthCommission,
      previousMonth: previousMonthCommission,
      ytd: ytdCommission,
      pending: pendingCommission,
      expected: null,
    },
  };
};

module.exports = {
  getAgencyPerformance,
  getAgentPerformance,
};
