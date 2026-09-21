const Property = require("../models/property.model");
const PropertyView = require("../models/property-view.model");
const Agent = require("../models/agent.model");
const User = require("../models/user.model");
const { ROLES } = require("../config/constants");

const getPublicMarketplaceSummary = async () => {
  const [
    publishedListings,
    publishedPropertyValueResult,
    activeAgents,
    activeUsers,
  ] = await Promise.all([
    // All currently published marketplace listings.
    Property.countDocuments({
      status: "Published",
    }),

    // Only count published Nigerian Buy listings whose
    // price represents a total property price.
    //
    // We deliberately exclude:
    // monthly rent
    // yearly lease
    // per-night pricing
    // per-plot pricing
    // per-acre pricing
    //
    // This prevents incompatible pricing units from being
    // added together and presented as one "property value".
    Property.aggregate([
      {
        $match: {
          status: "Published",
          transactionType: "buy",
          currency: "NGN",
          priceFrequency: "total",
          price: {
            $gt: 0,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: "$price",
          },
        },
      },
    ]),

    // Active Agents.
    Agent.countDocuments({
      status: "Active",
    }),

    // Active marketplace users.
    //
    // We count Buyers and Owners rather than internal
    // administration/workforce accounts.
    User.countDocuments({
      isActive: true,
      role: {
        $in: [
          ROLES.BUYER,
          ROLES.OWNER,
        ],
      },
    }),
  ]);

  return {
    publishedListings,

    publishedPropertyValue:
      publishedPropertyValueResult[0]?.totalValue || 0,

    activeAgents,
    activeUsers,

    generatedAt: new Date().toISOString(),
  };
};

const getPublicInvestmentIntelligence =
  async () => {
    /*
     * Use all published Buy listings with a valid total
     * asking price.
     *
     * We deliberately do NOT require rentAmount here.
     * Rental yield is only one part of the intelligence
     * section and should not prevent the rest of the
     * market data from being displayed.
     */
    const properties =
      await Property.find({
        status: "Published",
        availabilityStatus: "Available",
        transactionType: "buy",
        currency: "NGN",
        priceFrequency: "total",
        price: {
          $gt: 0,
        },
      })
        .select(
          [
            "title",
            "city",
            "state",
            "area",
            "propertyType",
            "price",
            "rentAmount",
            "coordinates",
            "verificationLevel",
            "inspectionStatus",
            "listingTier",
            "featuredLevel",
            "createdAt",
          ].join(" "),
        )
        .lean();

    /*
     * The Home page can still render a useful section
     * even when there are no qualifying properties.
     *
     * This is only the true "no data at all" fallback.
     */
    if (!properties.length) {
      return {
        sufficientData: false,

        message:
          "No published buy listings with valid asking prices are currently available.",

        metrics: {
          investmentScore: {
            value: null,
            sufficientData: false,
          },

          rentalYield: {
            value: null,
            sufficientData: false,
          },

          areaGrowth: {
            value: null,
            sufficientData: false,
          },
        },

        priceTrend: {
          sufficientData: false,
          periods: [],
        },

        topAreas: [],

        generatedAt:
          new Date().toISOString(),
      };
    }

    /*
     * Retrieve actual Property detail-page views.
     */
    const propertyIds =
      properties.map(
        (property) => property._id,
      );

    const viewRows =
      await PropertyView.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },
          },
        },

        {
          $group: {
            _id: "$property",
            views: {
              $sum: 1,
            },
          },
        },
      ]);

    const viewsByProperty =
      new Map(
        viewRows.map((row) => [
          String(row._id),
          row.views,
        ]),
      );

    /*
     * Find the strongest real demand signal so that
     * properties can be compared against each other.
     */
    const maxViews = Math.max(
      ...properties.map(
        (property) =>
          viewsByProperty.get(
            String(property._id),
          ) || 0,
      ),
      0,
    );

    /*
     * Map each published property into a lightweight
     * Home-page investment intelligence score.
     *
     * This score is NOT presented as realized ROI.
     *
     * It is based on:
     * - market demand / property views: 50%
     * - verification / inspection quality: 25%
     * - property data completeness: 25%
     */
    const enrichedProperties =
      properties.map(
        (property) => {
          const views =
            viewsByProperty.get(
              String(property._id),
            ) || 0;

          /*
           * Demand component.
           *
           * The highest-viewed property receives the
           * maximum 50 points.
           */
          const demandScore =
            maxViews > 0
              ? Number(
                  (
                    (views /
                      maxViews) *
                    50
                  ).toFixed(1),
                )
              : 0;

          /*
           * Verification component.
           */
          let verificationScore = 5;

          if (
            property.verificationLevel ===
            "Agent Reviewed"
          ) {
            verificationScore = 12;
          }

          if (
            property.verificationLevel ===
            "Documents Verified"
          ) {
            verificationScore = 18;
          }

          if (
            property.verificationLevel ===
            "Physical Inspection Completed"
          ) {
            verificationScore = 25;
          }

          /*
           * Data completeness component.
           */
          const completenessFields = [
            property.city,
            property.state,
            property.area,
            property.propertyType,
            property.coordinates
              ?.latitude,
            property.coordinates
              ?.longitude,
          ];

          const completedFields =
            completenessFields.filter(
              (value) =>
                value !==
                  null &&
                value !==
                  undefined &&
                value !== "",
            ).length;

          const completenessScore =
            Number(
              (
                (completedFields /
                  completenessFields.length) *
                25
              ).toFixed(1),
            );

          const investmentScore =
            Number(
              (
                demandScore +
                verificationScore +
                completenessScore
              ).toFixed(1),
            );

          /*
           * Asking rental yield is calculated only for
           * Properties where both asking price and
           * advertised rent are genuinely available.
           */
          const rentalYield =
            property.rentAmount >
              0 &&
            property.price > 0
              ? Number(
                  (
                    ((property.rentAmount *
                      12) /
                      property.price) *
                    100
                  ).toFixed(2),
                )
              : null;

          return {
            ...property,

            views,

            demandScore,

            verificationScore,

            completenessScore,

            investmentScore,

            rentalYield,
          };
        },
      );

    /*
     * Overall Investment Score.
     */
    const averageInvestmentScore =
      Number(
        (
          enrichedProperties.reduce(
            (sum, property) =>
              sum +
              property.investmentScore,
            0,
          ) /
          enrichedProperties.length
        ).toFixed(1),
      );

    /*
     * Rental Yield only uses records that actually have
     * both an asking price and advertised rent.
     */
    const yieldProperties =
      enrichedProperties.filter(
        (property) =>
          property.rentalYield !==
          null,
      );

    const averageRentalYield =
      yieldProperties.length
        ? Number(
            (
              yieldProperties.reduce(
                (sum, property) =>
                  sum +
                  property.rentalYield,
                0,
              ) /
              yieldProperties.length
            ).toFixed(2),
          )
        : null;

    /*
     * Group properties by area/city.
     *
     * We return available areas even when an area has
     * fewer than three properties. The response exposes
     * sampleSize so the frontend can communicate the
     * confidence level instead of hiding the area.
     */
    const areaGroups =
      new Map();

    for (const property of enrichedProperties) {
      const areaName =
        property.area ||
        property.city;

      if (!areaName) {
        continue;
      }

      const existing =
        areaGroups.get(areaName) || {
          name: areaName,
          properties: [],
        };

      existing.properties.push(
        property,
      );

      areaGroups.set(
        areaName,
        existing,
      );
    }

    const topAreas = Array.from(
      areaGroups.values(),
    )
      .map((group) => {
        const groupProperties =
          group.properties;

        const score =
          groupProperties.reduce(
            (sum, property) =>
              sum +
              property.investmentScore,
            0,
          ) /
          groupProperties.length;

        const areasWithYield =
          groupProperties.filter(
            (property) =>
              property.rentalYield !==
              null,
          );

        const averageYield =
          areasWithYield.length
            ? areasWithYield.reduce(
                (sum, property) =>
                  sum +
                  property.rentalYield,
                0,
              ) /
              areasWithYield.length
            : null;

        return {
          name: group.name,

          score: Number(
            score.toFixed(1),
          ),

          yield:
            averageYield === null
              ? null
              : Number(
                  averageYield.toFixed(
                    2,
                  ),
                ),

          growth: null,

          sampleSize:
            groupProperties.length,

          sufficientData:
            groupProperties.length >=
            3,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .slice(0, 4)
      .map((area, index) => ({
        ...area,
        rank: index + 1,
      }));

    /*
     * Build a real asking-price trend from the published
     * Buy listings.
     *
     * This uses listing asking prices by creation month.
     * It is explicitly an asking-price indicator, not
     * realized sale appreciation.
     */
    const trendRows =
      await Property.aggregate([
        {
          $match: {
            status: "Published",
            availabilityStatus:
              "Available",
            transactionType:
              "buy",
            currency: "NGN",
            priceFrequency:
              "total",
            price: {
              $gt: 0,
            },
          },
        },

        {
          $group: {
            _id: {
              year: {
                $year: "$createdAt",
              },

              month: {
                $month: "$createdAt",
              },
            },

            averageAskingPrice:
              {
                $avg: "$price",
              },

            listings: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]);

    const trendPeriods =
      trendRows.map((row) => {
        const month = String(
          row._id.month,
        ).padStart(2, "0");

        return {
          period: `${row._id.year}-${month}`,

          label: new Date(
            row._id.year,
            row._id.month - 1,
          ).toLocaleString(
            "en-US",
            {
              month: "short",
            },
          ),

          averageAskingPrice:
            Number(
              (
                row.averageAskingPrice ||
                0
              ).toFixed(0),
            ),

          listings:
            row.listings,
        };
      });

    /*
     * Calculate an asking-price change only when there
     * are enough historical periods.
     */
    let priceTrendGrowth = null;

    if (
      trendPeriods.length >= 2
    ) {
      const first =
        trendPeriods[0]
          .averageAskingPrice;

      const latest =
        trendPeriods[
          trendPeriods.length - 1
        ].averageAskingPrice;

      if (first > 0) {
        priceTrendGrowth =
          Number(
            (
              ((latest - first) /
                first) *
              100
            ).toFixed(1),
          );
      }
    }

    /*
     * Area growth requires actual historical area-level
     * asking-price periods. We do not manufacture it from
     * the current dataset.
     */
    const areaGrowth = null;

    return {
      sufficientData: true,

      dataScope:
        "Published, available Buy listings with valid total NGN asking prices.",

      scoreMethodology: {
        demandViews: 50,
        verificationAndInspection: 25,
        propertyDataCompleteness: 25,

        note:
          "Investment Score is a current listing intelligence signal derived from Luxora marketplace data. It is not realized investment ROI.",
      },

      metrics: {
        investmentScore: {
          value:
            averageInvestmentScore,

          sufficientData:
            true,

          label:
            "Current investment intelligence score",
        },

        rentalYield: {
          value:
            averageRentalYield,

          sufficientData:
            yieldProperties.length >
            0,

          sampleSize:
            yieldProperties.length,

          label:
            "Estimated from advertised rent and asking price; not realized ROI.",
        },

        areaGrowth: {
          value:
            areaGrowth,

          sufficientData:
            false,

          label:
            "Historical area-level asking-price growth is not yet available.",
        },
      },

      priceTrend: {
        sufficientData:
          trendPeriods.length >=
          2,

        growth:
          priceTrendGrowth,

        indicator:
          "Published asking-price trend; not closed-sale appreciation.",

        periods:
          trendPeriods.slice(-12),
      },

      topAreas,

      generatedAt:
        new Date().toISOString(),
    };
  };


module.exports = {
  getPublicMarketplaceSummary,
  getPublicInvestmentIntelligence,
};