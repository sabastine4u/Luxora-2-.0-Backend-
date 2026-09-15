const Payment = require("../models/payment.model");

// Create a new rental payment record.
const createPayment = async (paymentData) => {
  // Save the payment in MongoDB using the validated Payment schema.
  return Payment.create(paymentData);
};

// Get all rental payments belonging to the authenticated Owner.
const getPaymentsByOwner = async (ownerId) => {
  // Retrieve the Owner's payments and include related tenant and Property details.
  return Payment.find({ owner: ownerId })
    .populate("tenant", "fullName email phone")
    .populate("property", "title price transactionType priceFrequency")
    .sort({ createdAt: -1 });
};

// Get a single payment belonging to the authenticated Owner.
const getPaymentById = async (paymentId, ownerId) => {
  // Only return the payment when it belongs to the requesting Owner.
  return Payment.findOne({
    _id: paymentId,
    owner: ownerId,
  })
    .populate("tenant", "fullName email phone")
    .populate("property", "title price transactionType priceFrequency");
};

// Update the status of an Owner's rental payment.
const updatePaymentStatus = async (paymentId, ownerId, status, paidAt = null) => {
  // Update only a payment owned by the authenticated Owner.
  return Payment.findOneAndUpdate(
    {
      _id: paymentId,
      owner: ownerId,
    },
    {
      status,
      paidAt,
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  )
    .populate("tenant", "fullName email phone")
    .populate("property", "title price transactionType priceFrequency");
};

// Export the Payment service methods for controller usage.
module.exports = {
  createPayment,
  getPaymentsByOwner,
  getPaymentById,
  updatePaymentStatus,
};