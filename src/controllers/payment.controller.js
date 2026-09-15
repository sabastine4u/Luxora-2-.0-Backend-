const paymentService = require("../services/payment.service");

// Create a rental payment record.
const createPayment = async (req, res, next) => {
  try {
    // Force the authenticated Owner to be the payment owner.
    const paymentData = {
      ...req.body,
      owner: req.user._id,
    };

    // Create the payment through the service layer.
    const payment = await paymentService.createPayment(paymentData);

    // Return the newly created payment.
    return res.status(201).json({
      status: "success",
      data: {
        payment,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get all rental payments for the authenticated Owner.
const getOwnerPayments = async (req, res, next) => {
  try {
    // Retrieve only payments belonging to the logged-in Owner.
    const payments = await paymentService.getPaymentsByOwner(req.user._id);

    // Return the Owner's rental income records.
    return res.status(200).json({
      status: "success",
      results: payments.length,
      data: {
        payments,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Get one rental payment for the authenticated Owner.
const getPaymentById = async (req, res, next) => {
  try {
    // Retrieve the payment only when it belongs to the logged-in Owner.
    const payment = await paymentService.getPaymentById(
      req.params.id,
      req.user._id
    );

    // Return a not-found response when the payment does not belong to the Owner.
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment not found.",
      });
    }

    // Return the requested payment.
    return res.status(200).json({
      status: "success",
      data: {
        payment,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Update the status of an Owner's rental payment.
const updatePaymentStatus = async (req, res, next) => {
  try {
    // Read the status and optional payment date from the request body.
    const { status, paidAt } = req.body;

    // Update only a payment belonging to the authenticated Owner.
    const payment = await paymentService.updatePaymentStatus(
      req.params.id,
      req.user._id,
      status,
      paidAt || null
    );

    // Return a not-found response when the payment does not belong to the Owner.
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment not found.",
      });
    }

    // Return the updated payment.
    return res.status(200).json({
      status: "success",
      data: {
        payment,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the centralized error handler.
    return next(error);
  }
};

// Export the Payment controller methods for route usage.
module.exports = {
  createPayment,
  getOwnerPayments,
  getPaymentById,
  updatePaymentStatus,
};