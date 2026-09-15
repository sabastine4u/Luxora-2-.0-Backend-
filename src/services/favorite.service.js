const Favorite = require('../models/favorite.model');

// Create a new favorite for the authenticated Buyer.
const createFavorite = async (userId, propertyId) => {
  // Check whether the Buyer has already saved this Property.
  const existingFavorite = await Favorite.findOne({
    user: userId,
    property: propertyId,
  });

  // Return the existing record instead of creating a duplicate.
  if (existingFavorite) {
    return existingFavorite;
  }

  // Create and return the new Favorite relationship.
  return Favorite.create({
    user: userId,
    property: propertyId,
  });
};

// Get all Properties saved by the authenticated Buyer.
const getFavoritesByUser = async (userId) => {
  // Load the Buyer's favorites and include the related Property data.
  return Favorite.find({ user: userId })
    .populate('property')
    .sort({ createdAt: -1 });
};

// Check whether a specific Property is saved by the authenticated Buyer.
const checkFavorite = async (userId, propertyId) => {
  // Look for the Buyer + Property relationship.
  const favorite = await Favorite.findOne({
    user: userId,
    property: propertyId,
  });

  // Return a simple boolean for the frontend.
  return Boolean(favorite);
};

// Remove a saved Property for the authenticated Buyer.
const removeFavorite = async (userId, propertyId) => {
  // Delete only the Favorite belonging to this Buyer and Property.
  return Favorite.findOneAndDelete({
    user: userId,
    property: propertyId,
  });
};

module.exports = {
  createFavorite,
  getFavoritesByUser,
  checkFavorite,
  removeFavorite,
};