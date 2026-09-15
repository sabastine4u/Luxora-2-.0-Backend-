const User = require("../models/user.model");
const Property = require("../models/property.model");
const Offer = require("../models/offer.model");
const Booking = require("../models/booking.model");
const Inquiry = require("../models/inquiry.model");
const Commission = require("../models/commission.model");
const Complaint = require("../models/complaint.model");

const FINALIZED_PROPERTY_STATUSES = [
  "Sold",
  "Rented",
  "Leased",
];

const LIVE_PROPERTY_STATUSES = [
  "Published",
  "Under Offer",
];

const MANAGEMENT_TEAM_ROLES = [
  "Procurement Officer",
  "Finance Manager",
  "Data Analyst",
  "Property Manager",
  "Service Manager",
];

const getManagementPerformance =
  async () => {
    /*
     * ---------------------------------------------------------
     * PROPERTY / TRANSACTION PERFORMANCE
     * ---------------------------------------------------------
     */

    const [
      totalProperties,
      liveProperties,
      finalizedProperties,
      totalOffers,
      acceptedOffers,
      totalBookings,
      totalInquiries,
      totalComplaints,
      resolvedComplaints,
      activeTeamMembers,
      inactiveTeamMembers,
    ] = await Promise.all([
      Property.countDocuments(),

      Property.countDocuments({
        status: {
          $in: LIVE_PROPERTY_STATUSES,
        },
      }),

      Property.countDocuments({
        status: {
          $in: FINALIZED_PROPERTY_STATUSES,
        },
      }),

      Offer.countDocuments(),

      Offer.countDocuments({
        status: "Accepted",
      }),

      Booking.countDocuments(),

      Inquiry.countDocuments(),

      Complaint.countDocuments(),

      Complaint.countDocuments({
        status: {
          $in: ["Resolved", "Closed"],
        },
      }),

      User.countDocuments({
        role: {
          $in: MANAGEMENT_TEAM_ROLES,
        },
        isActive: true,
      }),

      User.countDocuments({
        role: {
          $in: MANAGEMENT_TEAM_ROLES,
        },
        isActive: false,
      }),
    ]);

    /*
     * ---------------------------------------------------------
     * CLOSED DEAL VALUE
     *
     * A transaction is counted only when:
     *
     * 1. The Offer was accepted
     * 2. The related Property is finalized
     * ---------------------------------------------------------
     */

    const completedOffers =
      await Offer.find({
        status: "Accepted",
      })
        .select(
          "_id property offerAmount createdAt",
        )
        .lean();

    const finalizedPropertyIds =
      new Set(
        (
          await Property.find({
            status: {
              $in:
                FINALIZED_PROPERTY_STATUSES,
            },
          })
            .select("_id")
            .lean()
        ).map((property) =>
          String(property._id),
        ),
      );

    const finalizedOffers =
      completedOffers.filter((offer) =>
        finalizedPropertyIds.has(
          String(offer.property),
        ),
      );

    const closedDealValue =
      finalizedOffers.reduce(
        (total, offer) =>
          total +
          Number(
            offer.offerAmount || 0,
          ),
        0,
      );

    /*
     * ---------------------------------------------------------
     * COMMISSION / REVENUE DATA
     *
     * Commission records are created from
     * finalized transactions and provide the
     * actual commission amounts stored by Luxora.
     * ---------------------------------------------------------
     */

    const commissionTotals =
      await Commission.aggregate([
        {
          $group: {
            _id: null,
            commissionPool: {
              $sum: "$commissionPool",
            },
            agencyAmount: {
              $sum: "$agencyAmount",
            },
            dealValue: {
              $sum: "$dealValue",
            },
            dealCount: {
              $sum: 1,
            },
          },
        },
      ]);

    const commissionSummary =
      commissionTotals[0] || {
        commissionPool: 0,
        agencyAmount: 0,
        dealValue: 0,
        dealCount: 0,
      };

    /*
     * ---------------------------------------------------------
     * FUNNEL
     * ---------------------------------------------------------
     *
     * Inquiry -> Viewing -> Offer -> Closed Deal
     */

    const funnel = {
      inquiries: totalInquiries,
      viewings: totalBookings,
      offers: totalOffers,
      closedDeals: finalizedProperties,

      acceptedOffers,

      offerAcceptanceRate:
        totalOffers > 0
          ? Number(
              (
                (acceptedOffers /
                  totalOffers) *
                100
              ).toFixed(1),
            )
          : null,

      closingRate:
        totalOffers > 0
          ? Number(
              (
                (finalizedOffers.length /
                  totalOffers) *
                100
              ).toFixed(1),
            )
          : null,
    };

    /*
     * ---------------------------------------------------------
     * PROPERTY DISTRIBUTION
     * ---------------------------------------------------------
     */

    const propertyDistribution =
      await Property.aggregate([
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]);

    /*
     * ---------------------------------------------------------
     * SIX-MONTH PERFORMANCE TREND
     *
     * Commission creation represents a
     * completed transaction being recorded.
     * ---------------------------------------------------------
     */

    const now = new Date();

    const monthlyTrend = [];

    for (
      let offset = 5;
      offset >= 0;
      offset -= 1
    ) {
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1,
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth() -
          offset +
          1,
        1,
      );

      const monthlyCommission =
        await Commission.aggregate([
          {
            $match: {
              createdAt: {
                $gte: start,
                $lt: end,
              },
            },
          },
          {
            $group: {
              _id: null,

              dealValue: {
                $sum: "$dealValue",
              },

              commissionPool: {
                $sum: "$commissionPool",
              },

              agencyAmount: {
                $sum: "$agencyAmount",
              },

              deals: {
                $sum: 1,
              },
            },
          },
        ]);

      const month =
        monthlyCommission[0] || {
          dealValue: 0,
          commissionPool: 0,
          agencyAmount: 0,
          deals: 0,
        };

      monthlyTrend.push({
        month: start.toLocaleString(
          "en-NG",
          {
            month: "short",
          },
        ),
        year: start.getFullYear(),

        dealValue:
          Number(month.dealValue) || 0,

        commissionPool:
          Number(
            month.commissionPool,
          ) || 0,

        agencyAmount:
          Number(
            month.agencyAmount,
          ) || 0,

        deals:
          Number(month.deals) || 0,
      });
    }

    /*
     * ---------------------------------------------------------
     * COMPLAINT / SERVICE HEALTH
     * ---------------------------------------------------------
     */

    const complaintResolutionRate =
      totalComplaints > 0
        ? Number(
            (
              (resolvedComplaints /
                totalComplaints) *
              100
            ).toFixed(1),
          )
        : null;

    /*
     * ---------------------------------------------------------
     * RESPONSE
     * ---------------------------------------------------------
     */

    return {
      summary: {
        totalProperties,
        liveProperties,
        finalizedProperties,

        totalOffers,
        acceptedOffers,

        totalInquiries,
        totalViewings:
          totalBookings,

        closedDealValue,

        commissionPool:
          commissionSummary.commissionPool,

        agencyCommission:
          commissionSummary.agencyAmount,

        recordedCommissionDeals:
          commissionSummary.dealCount,

        activeTeamMembers,
        inactiveTeamMembers,

        complaintResolutionRate,
      },

      funnel,

      propertyDistribution,

      monthlyTrend,

      serviceHealth: {
        totalComplaints,
        resolvedComplaints,
        complaintResolutionRate,
      },
    };
  };

module.exports = {
  getManagementPerformance,
};