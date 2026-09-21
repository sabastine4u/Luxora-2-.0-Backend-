const Property = require("../models/property.model");

const getPropertyLocations = async () => {
  const locations = await Property.aggregate([
    {
      $match: {
        status: "Published",
      },
    },

    {
      $match: {
        cityNormalized: {
          $exists: true,
          $ne: "",
        },
      },
    },

    {
      $group: {
        _id: "$cityNormalized",

        city: {
          $first: "$city",
        },

        state: {
          $first: "$state",
        },

        listingCount: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        listingCount: -1,
        city: 1,
      },
    },

    {
      $project: {
        _id: 0,
        city: 1,
        state: 1,
        listingCount: 1,
      },
    },
  ]);

  return locations;
};

module.exports = {
  getPropertyLocations,
};