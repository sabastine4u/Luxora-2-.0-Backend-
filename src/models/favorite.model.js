const mongoose = require('mongoose');

// Store the relationship between a Buyer and a saved Property.
const favoriteSchema = new mongoose.Schema(
  {
    // Reference the authenticated Buyer who saved the Property.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Reference the Property saved by the Buyer.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
  },
  {
    // Keep createdAt and updatedAt for tracking the saved relationship.
    timestamps: true,
  },
);

// Prevent the same Buyer from saving the same Property more than once.
favoriteSchema.index(
  { user: 1, property: 1 },
  { unique: true },
);

// Export the Favorite model.
module.exports = mongoose.model('Favorite', favoriteSchema);