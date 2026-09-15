const User = require("../models/user.model");
const Agency = require("../models/agency.model");
const Agent = require("../models/agent.model");
const Property = require("../models/property.model");
const Commission = require("../models/commission.model");
const { success } = require("../utils/api-response");

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

exports.getAdminReport = async (req, res, next) => {
  try {
    const {
      category = "financial",
      startDate,
      endDate,
    } = req.query;

    const createdAtRange =
      getDateRange(
        startDate,
        endDate,
      );

    if (
      category ===
      "financial"
    ) {
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

      return success(
        res,
        {
          report: {
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
          },
        },
        "Financial report retrieved successfully",
      );
    }

    if (
      category ===
      "user-growth"
    ) {
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

      return success(
        res,
        {
          report: {
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
          },
        },
        "User growth report retrieved successfully",
      );
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

      return success(
        res,
        {
          report: {
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
          },
        },
        "Listing performance report retrieved successfully",
      );
    }

    if (
      category ===
      "system-audit"
    ) {
      return success(
        res,
        {
          report: {
            category,
            startDate:
              startDate || null,
            endDate:
              endDate || null,
            available: false,
            metrics: null,
            message:
              "System audit reporting is not yet available because the audit-log backend has not been implemented.",
          },
        },
        "System audit report is not yet available",
      );
    }

    return res.status(400).json({
      success: false,
      message:
        "Unsupported report category",
    });
  } catch (error) {
    next(error);
  }
};

exports.getManagerReport = async (
  req,
  res,
  next,
) => {
  try {
    const {
      category = "financial",
      startDate,
      endDate,
    } = req.query;

    const createdAtRange =
      getDateRange(
        startDate,
        endDate,
      );

    /*
     * Manager Financial Report
     *
     * Uses the same real Commission data
     * already used by Admin Reports.
     */
    if (
      category ===
      "financial"
    ) {
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

      const agencyCommission =
        activeCommissions.reduce(
          (total, commission) =>
            total +
            Number(
              commission.agencyAmount ||
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

      return success(
        res,
        {
          report: {
            category,
            startDate:
              startDate || null,
            endDate:
              endDate || null,

            metrics: {
              totalGMV,
              totalCommission,
              agencyCommission,
              paidCommission,
              transactionCount:
                activeCommissions.length,
            },
          },
        },
        "Manager financial report retrieved successfully",
      );
    }

    /*
     * Manager Listing Performance
     *
     * Uses the existing Property collection.
     */
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

      return success(
        res,
        {
          report: {
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
          },
        },
        "Manager listing performance report retrieved successfully",
      );
    }

    /*
     * Manager Workforce Report
     *
     * This uses the same five operational dashboard
     * roles we established for Team Management.
     */
    if (
      category ===
      "workforce"
    ) {
      const managementRoles = [
        "Procurement Officer",
        "Finance Manager",
        "Data Analyst",
        "Property Manager",
        "Service Manager",
      ];

      const [
        totalStaff,
        activeStaff,
        inactiveStaff,
        verifiedStaff,
      ] = await Promise.all([
        User.countDocuments({
          role: {
            $in: managementRoles,
          },
        }),

        User.countDocuments({
          role: {
            $in: managementRoles,
          },
          isActive: true,
        }),

        User.countDocuments({
          role: {
            $in: managementRoles,
          },
          isActive: false,
        }),

        User.countDocuments({
          role: {
            $in: managementRoles,
          },
          isVerified: true,
        }),
      ]);

      const departmentBreakdown =
        await User.aggregate([
          {
            $match: {
              role: {
                $in: managementRoles,
              },
            },
          },
          {
            $group: {
              _id: {
                $ifNull: [
                  "$department",
                  "Unassigned",
                ],
              },

              total: {
                $sum: 1,
              },

              active: {
                $sum: {
                  $cond: [
                    "$isActive",
                    1,
                    0,
                  ],
                },
              },

              inactive: {
                $sum: {
                  $cond: [
                    "$isActive",
                    0,
                    1,
                  ],
                },
              },
            },
          },
          {
            $sort: {
              _id: 1,
            },
          },
        ]);

      return success(
        res,
        {
          report: {
            category,
            startDate:
              startDate || null,
            endDate:
              endDate || null,

            metrics: {
              totalStaff,
              activeStaff,
              inactiveStaff,
              verifiedStaff,
              departmentBreakdown,
            },
          },
        },
        "Manager workforce report retrieved successfully",
      );
    }

    /*
     * System Audit remains unavailable.
     *
     * We do not fabricate audit data.
     */
    if (
      category ===
      "system-audit"
    ) {
      return success(
        res,
        {
          report: {
            category,
            startDate:
              startDate || null,
            endDate:
              endDate || null,
            available: false,
            metrics: null,
            message:
              "System audit reporting is not yet available because the audit-log backend has not been implemented.",
          },
        },
        "System audit report is not yet available",
      );
    }

    return res.status(400).json({
      success: false,
      message:
        "Unsupported Manager report category",
    });
  } catch (error) {
    next(error);
  }
};