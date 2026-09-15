// Import Mongoose so we can define the Booking schema and model.
const mongoose = require("mongoose");

// Define the Booking schema used to store Buyer viewing requests.
const bookingSchema = new mongoose.Schema(
  {
    // Store the Buyer who created the viewing request.
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Store the Property the Buyer wants to view.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    // Store the preferred date for the viewing.
    viewingDate: {
      type: Date,
      required: true,
    },

    // Store the preferred time for the viewing.
    viewingTime: {
      type: String,
      required: true,
      trim: true,
    },

    // Store any additional message supplied by the Buyer.
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // Track the current state of the viewing request.
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Rescheduled",
        "Completed",
        "Cancelled",
        "Rejected",
      ],
      default: "Pending",
      index: true,
    },
  },
  {
    // Automatically create createdAt and updatedAt timestamps.
    timestamps: true,
  },
);

// Create an index that helps find a Buyer's viewing requests quickly.
bookingSchema.index({
  buyer: 1,
  createdAt: -1,
});

// Export the Booking model.
module.exports = mongoose.model("Booking", bookingSchema);