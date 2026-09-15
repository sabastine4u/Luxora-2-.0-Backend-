const Commission = require("../models/commission.model");
const SystemSettings = require("../models/system-settings.model");
const api = require("../utils/api-response");
const AppError = require("../utils/AppError");

exports.getAdminFinanceSummary = async (req, res, next) => {
  try {
    /*
     * Load the current Luxora platform fee.
     * This is the percentage used to calculate
     * Luxora's revenue from GMV.
     */
    let systemSettings = await SystemSettings.findOne({
      key: "global",
    });

    /*
     * If global settings do not exist yet,
     * use the same defaults as the System Settings module.
     */
    if (!systemSettings) {
      systemSettings = await SystemSettings.create({
        key: "global",
        platformFee: 5,
        currency: "NGN",
        maintenanceMode: false,
        updatedBy: req.user._id,
      });
    }

    const now = new Date();

    /*
     * Current year:
     * January 1 of the current calendar year.
     */
    const currentYearStart = new Date(
      now.getFullYear(),
      0,
      1,
    );

    /*
     * Previous year:
     * January 1 of last year.
     */
    const previousYearStart = new Date(
      now.getFullYear() - 1,
      0,
      1,
    );

    /*
     * Same point last year.
     * This lets us calculate YTD growth fairly.
     */
    const previousYearEquivalent = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
    );

    /*
     * Only finalized commission records represent
     * completed platform transactions.
     *
     * Cancelled records are excluded from GMV.
     */
    const completedStatuses = [
      "Pending",
      "Processing",
      "Paid",
      "Overdue",
    ];

    /*
     * Current YTD GMV.
     */
    const currentYearResult =
      await Commission.aggregate([
        {
          $match: {
            createdAt: {
              $gte: currentYearStart,
              $lte: now,
            },
            status: {
              $in: completedStatuses,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalGMV: {
              $sum: "$dealValue",
            },
            transactionCount: {
              $sum: 1,
            },
          },
        },
      ]);

    /*
     * Previous-year YTD GMV.
     */
    const previousYearResult =
      await Commission.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousYearStart,
              $lte: previousYearEquivalent,
            },
            status: {
              $in: completedStatuses,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalGMV: {
              $sum: "$dealValue",
            },
            transactionCount: {
              $sum: 1,
            },
          },
        },
      ]);

    const currentGMV =
      Number(
        currentYearResult[0]?.totalGMV || 0,
      );

    const previousGMV =
      Number(
        previousYearResult[0]?.totalGMV || 0,
      );

    /*
     * Luxora revenue is calculated from the
     * current global platform fee percentage.
     */
    const platformFeePercent =
      Number(
        systemSettings.platformFee || 0,
      );

    const currentRevenue =
      currentGMV *
      (platformFeePercent / 100);

    const previousRevenue =
      previousGMV *
      (platformFeePercent / 100);

    /*
     * Calculate year-over-year GMV growth.
     */
    const gmvGrowth =
      previousGMV > 0
        ? ((currentGMV - previousGMV) /
            previousGMV) *
          100
        : 0;

    /*
     * Revenue growth follows the same
     * percentage because the platform fee
     * is applied consistently.
     */
    const revenueGrowth =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) /
            previousRevenue) *
          100
        : 0;

    /*
     * Agency amounts that have not yet been paid.
     */
    const pendingPayoutResult =
      await Commission.aggregate([
        {
          $match: {
            status: {
              $in: [
                "Pending",
                "Processing",
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPendingPayouts: {
              $sum: "$agencyAmount",
            },
            payoutCount: {
              $sum: 1,
            },
          },
        },
      ]);

    const pendingAgencyPayouts =
      Number(
        pendingPayoutResult[0]
          ?.totalPendingPayouts || 0,
      );

    /*
     * Retrieve recent large completed
     * transactions for the Admin ledger.
     */
    const recentTransactions =
      await Commission.find({
        status: {
          $in: completedStatuses,
        },
      })
        .populate({
          path: "property",
          select:
            "title transactionType price agencyFee",
        })
        .populate({
          path: "agency",
          select:
            "name contactPerson email",
        })
        .sort({
          dealValue: -1,
          createdAt: -1,
        })
        .limit(10)
        .lean();

    const transactions =
      recentTransactions.map(
        (commission) => ({
          id: commission.commissionId,

          property:
            commission.property?.title ||
            "Unknown Property",

          agency:
            commission.agency?.name ||
            "Independent",

          value:
            Number(
              commission.dealValue || 0,
            ),

          fee:
            Number(
              commission.dealValue || 0,
            ) *
            (platformFeePercent / 100),

          status:
            commission.status,

          createdAt:
            commission.createdAt,
        }),
      );

    return api.success(
      res,
      {
        summary: {
          totalGMV: currentGMV,
          revenue: currentRevenue,
          pendingAgencyPayouts,
          gmvGrowth,
          revenueGrowth,
          platformFeePercent,
          currency:
            systemSettings.currency,
        },

        transactions,
      },
      "Admin finance summary retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};