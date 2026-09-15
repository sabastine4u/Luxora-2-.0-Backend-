const User = require("../models/user.model");
const Property = require("../models/property.model");
const Commission = require("../models/commission.model");

const getDateRange = (startDate, endDate) => {
  const range = {};

  if (startDate) {
    range.$gte = new Date(startDate);
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return Object.keys(range).length
    ? range
    : null;
};

const generateReport = async ({
  category = "financial",
  startDate,
  endDate,
}) => {
  const createdAtRange =
    getDateRange(
      startDate,
      endDate,
    );

  if (category === "financial") {
    const commissionFilter =
      createdAtRange
        ? {
            createdAt:
              createdAtRange,
          }
        : {};

    const commissions =
      await Commission.find(
        commissionFilter,
      ).lean();

    const activeStatuses = [
      "Pending",
      "Processing",
      "Paid",
      "Overdue",
    ];

    const activeCommissions =
      commissions.filter(
        (commission) =>
          activeStatuses.includes(
            commission.status,
          ),
      );

    const totalGMV =
      activeCommissions.reduce(
        (total, commission) =>
          total +
          Number(
            commission.dealValue || 0,
          ),
        0,
      );

    const totalCommission =
      activeCommissions.reduce(
        (total, commission) =>
          total +
          Number(
            commission.commissionPool ||
              0,
          ),
        0,
      );

    const paidCommission =
      activeCommissions
        .filter(
          (commission) =>
            commission.status ===
            "Paid",
        )
        .reduce(
          (total, commission) =>
            total +
            Number(
              commission.commissionPool ||
                0,
            ),
          0,
        );

    return {
      category,
      startDate:
        startDate || null,
      endDate:
        endDate || null,
      metrics: {
        totalGMV,
        totalCommission,
        paidCommission,
        transactionCount:
          activeCommissions.length,
      },
    };
  }

  if (category === "user-growth") {
    const userFilter =
      createdAtRange
        ? {
            createdAt:
              createdAtRange,
          }
        : {};

    const [
      users,
      owners,
      buyers,
      agents,
      agencies,
      admins,
    ] = await Promise.all([
      User.countDocuments(
        userFilter,
      ),

      User.countDocuments({
        ...userFilter,
        role: "Owner",
      }),

      User.countDocuments({
        ...userFilter,
        role: "Buyer",
      }),

      User.countDocuments({
        ...userFilter,
        role: "Agent",
      }),

      User.countDocuments({
        ...userFilter,
        role: "Agency",
      }),

      User.countDocuments({
        ...userFilter,
        role: {
          $in: [
            "Admin",
            "Super Admin",
          ],
        },
      }),
    ]);

    return {
      category,
      startDate:
        startDate || null,
      endDate:
        endDate || null,
      metrics: {
        totalUsers: users,
        owners,
        buyers,
        agents,
        agencies,
        administrators:
          admins,
      },
    };
  }

  if (
    category ===
    "listing-performance"
  ) {
    const propertyFilter =
      createdAtRange
        ? {
            createdAt:
              createdAtRange,
          }
        : {};

    const [
      total,
      draft,
      pendingReview,
      approved,
      published,
      underOffer,
      sold,
      rented,
      leased,
      archived,
    ] = await Promise.all([
      Property.countDocuments(
        propertyFilter,
      ),

      Property.countDocuments({
        ...propertyFilter,
        status: "Draft",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Pending Review",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Approved",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Published",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Under Offer",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Sold",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Rented",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Leased",
      }),

      Property.countDocuments({
        ...propertyFilter,
        status: "Archived",
      }),
    ]);

    return {
      category,
      startDate:
        startDate || null,
      endDate:
        endDate || null,
      metrics: {
        total,
        draft,
        pendingReview,
        approved,
        published,
        underOffer,
        sold,
        rented,
        leased,
        archived,
      },
    };
  }

  if (category === "system-audit") {
    return {
      category,
      startDate:
        startDate || null,
      endDate:
        endDate || null,
      available: false,
      metrics: null,
      message:
        "System audit reporting is not yet available.",
    };
  }

  throw new Error(
    "Unsupported report category",
  );
};

module.exports = {
  generateReport,
};