const express = require('express');

const {
  createFavorite,
  getFavorites,
  checkFavorite,
  removeFavorite,
} = require('../controllers/favorite.controller');

// Import the authentication middleware used by protected API routes.
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Get all Favorites belonging to the authenticated Buyer.
router.get('/', protect, getFavorites);

// Check whether a specific Property is already favorited.
router.get('/:propertyId/check', protect, checkFavorite);

// Add a Property to the authenticated Buyer's favorites.
router.post('/:propertyId', protect, createFavorite);

// Remove a Property from the authenticated Buyer's favorites.
router.delete('/:propertyId', protect, removeFavorite);

module.exports = router;