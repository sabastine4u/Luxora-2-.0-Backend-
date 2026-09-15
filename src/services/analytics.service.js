const Property = require("../models/property.model");
const Favorite = require("../models/favorite.model");
const Booking = require("../models/booking.model");
const Offer = require("../models/offer.model");
const Payment = require("../models/payment.model");
// Import real Property view events for Owner analytics.
const PropertyView = require("../models/property-view.model");

// Build the Owner analytics dashboard from real MongoDB records.
const getOwnerAnalytics = async (ownerId) => {
  // Load only the properties belonging to the authenticated Owner.
  const properties = await Property.find({
    owner: ownerId,
  })
    .select(
      "_id title status availabilityStatus transactionType rentAmount price createdAt"
    )
    .lean();

  // Extract the Owner's property IDs for the related analytics collections.
  const propertyIds = properties.map((property) => property._id);

  // Return empty but valid analytics when the Owner has no properties.
  if (propertyIds.length === 0) {
    return {
      metrics: {
        totalProperties: 0,
        publishedProperties: 0,
        totalFavorites: 0,
        totalPropertyViews: 0,
        totalViewings: 0,
        completedViewings: 0,
        activeOffers: 0,
        acceptedOffers: 0,
        offerConversionRate: 0,
        viewingCompletionRate: 0,
        rentalIncomeYTD: 0,
        totalRentalIncome: 0,
      },
      monthlyRentalIncome: [],
      dailyPropertyViews: [],
      topProperties: [],
    };
  }

  // Calculate the start of the current calendar year for YTD income.
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  // Run the independent analytics aggregations together.
  const [
    favoriteCounts,
    bookingCounts,
    offerCounts,
    rentalIncome,
    rentalIncomeYTD,
    monthlyRentalIncome,
    viewCounts,
    dailyPropertyViews,
  ] = await Promise.all([
    // Count real favorites saved against each Owner property.
    Favorite.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
        },
      },
      {
        $group: {
          _id: "$property",
          count: { $sum: 1 },
        },
      },
    ]),

    // Count real viewing requests for each Owner property.
    Booking.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
        },
      },
      {
        $group: {
          _id: "$property",
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },
        },
      },
    ]),

    // Count real offers for each Owner property.
    Offer.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
        },
      },
      {
        $group: {
          _id: "$property",
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "Draft",
                      "Submitted",
                      "Under Review",
                      "Counter Offer Received",
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },
          accepted: {
            $sum: {
              $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0],
            },
          },
        },
      },
    ]),

    // Calculate all paid rental income belonging to the Owner's properties.
    Payment.aggregate([
      {
        $match: {
          owner: ownerId,
          property: { $in: propertyIds },
          status: "Paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),

    // Calculate paid rental income received during the current calendar year.
    Payment.aggregate([
      {
        $match: {
          owner: ownerId,
          property: { $in: propertyIds },
          status: "Paid",
          paidAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),

    // Build real monthly rental income for the current calendar year.
    Payment.aggregate([
      {
        $match: {
          owner: ownerId,
          property: { $in: propertyIds },
          status: "Paid",
          paidAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: { $month: "$paidAt" },
          income: { $sum: "$amount" },
        },
      },
      {
        $sort: {
          "_id": 1,
        },
      },
    ]),

    // Count all real Property detail-page views for each Owner property.
    PropertyView.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
        },
      },
      {
        $group: {
          _id: "$property",
          count: { $sum: 1 },
        },
      },
    ]),

    // Build the last 30 days of real Property view activity.
    PropertyView.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
          viewedAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$viewedAt" },
            month: { $month: "$viewedAt" },
            day: { $dayOfMonth: "$viewedAt" },
          },
          views: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]),
  ]);

  // Convert aggregation results into quick property lookup maps.
  const favoriteMap = new Map(
    favoriteCounts.map((item) => [String(item._id), item.count])
  );

  const bookingMap = new Map(
    bookingCounts.map((item) => [
      String(item._id),
      {
        total: item.total,
        completed: item.completed,
      },
    ])
  );

  const offerMap = new Map(
    offerCounts.map((item) => [
      String(item._id),
      {
        total: item.total,
        active: item.active,
        accepted: item.accepted,
      },
    ])
  );

  // Convert Property view aggregation results into a quick lookup map.
  const viewMap = new Map(
    viewCounts.map((item) => [String(item._id), item.count])
  );

  // Calculate Owner-level totals from the real property analytics.
  const totalFavorites = favoriteCounts.reduce(
    (total, item) => total + item.count,
    0
  );

  // Calculate the total real Property views across the Owner's portfolio.
  const totalPropertyViews = viewCounts.reduce(
    (total, item) => total + item.count,
    0
  );

  const totalViewings = bookingCounts.reduce(
    (total, item) => total + item.total,
    0
  );

  const completedViewings = bookingCounts.reduce(
    (total, item) => total + item.completed,
    0
  );

  const totalOffers = offerCounts.reduce(
    (total, item) => total + item.total,
    0
  );

  const activeOffers = offerCounts.reduce(
    (total, item) => total + item.active,
    0
  );

  const acceptedOffers = offerCounts.reduce(
    (total, item) => total + item.accepted,
    0
  );

  // Calculate conversion ratios only from real lifecycle records.
  const offerConversionRate =
    totalOffers > 0 ? (acceptedOffers / totalOffers) * 100 : 0;

  const viewingCompletionRate =
    totalViewings > 0 ? (completedViewings / totalViewings) * 100 : 0;

  // Build the Owner's property performance list from real related records.
  const topProperties = properties
    .map((property) => {
      const propertyId = String(property._id);

      const favorites = favoriteMap.get(propertyId) || 0;

      // Read the real view count for this Property.
      const views = viewMap.get(propertyId) || 0;

      const viewingData = bookingMap.get(propertyId) || {
        total: 0,
        completed: 0,
      };

      const offerData = offerMap.get(propertyId) || {
        total: 0,
        active: 0,
        accepted: 0,
      };

      // Include real Property views in the performance score.
      const performanceScore =
        views +
        favorites +
        viewingData.total +
        offerData.total +
        offerData.accepted * 2;

      return {
        propertyId: property._id,
        title: property.title,
        status: property.status,
        transactionType: property.transactionType,
        views,
        favorites,
        viewings: viewingData.total,
        completedViewings: viewingData.completed,
        offers: offerData.total,
        activeOffers: offerData.active,
        acceptedOffers: offerData.accepted,
        performanceScore,
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore);

  // Convert monthly aggregation results into frontend-friendly month objects.
  const monthlyIncomeMap = new Map(
    monthlyRentalIncome.map((item) => [item._id, item.income])
  );

  const currentYear = new Date().getFullYear();

  // Return all supported Owner analytics in one response.
  return {
    metrics: {
      totalProperties: properties.length,
      publishedProperties: properties.filter(
        (property) => property.status === "Published"
      ).length,
      totalFavorites,
      totalPropertyViews,
      totalViewings,
      completedViewings,
      activeOffers,
      acceptedOffers,
      offerConversionRate: Number(offerConversionRate.toFixed(1)),
      viewingCompletionRate: Number(viewingCompletionRate.toFixed(1)),
      rentalIncomeYTD: rentalIncomeYTD[0]?.total || 0,
      totalRentalIncome: rentalIncome[0]?.total || 0,
    },

    monthlyRentalIncome: Array.from({ length: 12 }, (_, index) => ({
      month: new Date(currentYear, index, 1).toLocaleDateString("en-US", {
        month: "short",
      }),
      income: monthlyIncomeMap.get(index + 1) || 0,
    })),

    // Return real daily Property views for the last 30 days.
    dailyPropertyViews: dailyPropertyViews.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(
        2,
        "0"
      )}-${String(item._id.day).padStart(2, "0")}`,
      views: item.views,
    })),

    topProperties,
  };
};

// Export the Owner analytics service for the controller.
module.exports = {
  getOwnerAnalytics,
};