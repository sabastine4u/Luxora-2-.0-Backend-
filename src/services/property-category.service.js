const Property = require("../models/property.model");
const { PROPERTY_TYPES } = require("../config/constants");

const getPropertyCategories = async () => {
  const categoryCounts = await Property.aggregate([
    {
      $match: {
        status: "Published",
      },
    },
    {
      $group: {
        _id: {
          $toLower: {
            $ifNull: [
              "$propertyTypeNormalized",
              "$propertyType",
            ],
          },
        },
        listingCount: {
          $sum: 1,
        },
      },
    },
  ]);

  const countMap = new Map(
    categoryCounts.map((category) => [
      category._id,
      category.listingCount,
    ]),
  );

  return PROPERTY_TYPES.map((propertyType, index) => {
    const normalizedType = propertyType
      .trim()
      .toLowerCase();

    return {
      name: propertyType,
      key: normalizedType.replace(/\s+/g, "-"),
      sortOrder: index + 1,
      listingCount: countMap.get(normalizedType) || 0,
    };
  });
};

module.exports = {
  getPropertyCategories,
};