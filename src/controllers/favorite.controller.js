const favoriteService = require('../services/favorite.service');

// Save a Property for the authenticated Buyer.
const createFavorite = async (req, res, next) => {
  try {
    // Use the authenticated user's ID from the protected route.
    const userId = req.user._id;

    // Read the Property ID from the route parameter.
    const { propertyId } = req.params;

    // Create the Favorite relationship.
    const favorite = await favoriteService.createFavorite(
      userId,
      propertyId,
    );

    // Return the saved Favorite to the frontend.
    return res.status(201).json({
      success: true,
      message: 'Property added to favorites.',
      favorite,
    });
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Get all Properties saved by the authenticated Buyer.
const getFavorites = async (req, res, next) => {
  try {
    // Use the authenticated user's ID from the protected route.
    const userId = req.user._id;

    // Load the Buyer's saved Properties.
    const favorites = await favoriteService.getFavoritesByUser(userId);

    // Return the saved Properties.
    return res.status(200).json({
      success: true,
      favorites,
    });
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Check whether a specific Property is already saved.
const checkFavorite = async (req, res, next) => {
  try {
    // Use the authenticated user's ID from the protected route.
    const userId = req.user._id;

    // Read the Property ID from the route parameter.
    const { propertyId } = req.params;

    // Check the Buyer + Property relationship.
    const isFavorite = await favoriteService.checkFavorite(
      userId,
      propertyId,
    );

    // Return the result as a simple boolean.
    return res.status(200).json({
      success: true,
      isFavorite,
    });
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Remove a Property from the authenticated Buyer's favorites.
const removeFavorite = async (req, res, next) => {
  try {
    // Use the authenticated user's ID from the protected route.
    const userId = req.user._id;

    // Read the Property ID from the route parameter.
    const { propertyId } = req.params;

    // Remove the Favorite relationship.
    const favorite = await favoriteService.removeFavorite(
      userId,
      propertyId,
    );

    // Return a clear response when the Favorite did not exist.
    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found.',
      });
    }

    // Confirm successful removal.
    return res.status(200).json({
      success: true,
      message: 'Property removed from favorites.',
    });
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

module.exports = {
  createFavorite,
  getFavorites,
  checkFavorite,
  removeFavorite,
};