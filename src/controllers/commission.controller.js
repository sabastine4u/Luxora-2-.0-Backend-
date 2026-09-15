// Import the Commission service containing the business logic.
const commissionService = require("../services/commission.service");

// Generate a commission for a finalized property transaction.
const generateCommission = async (req, res, next) => {
  try {
    // Read the required identifiers from the request body.
    const { propertyId, offerId } = req.body;

    // Validate that both relationships were supplied.
    if (!propertyId || !offerId) {
      return res.status(400).json({
        success: false,
        message: "propertyId and offerId are required",
      });
    }

    // Generate the commission for the authenticated Agency.
    const commission = await commissionService.generateCommission(
      req.user._id,
      propertyId,
      offerId,
    );

    // Return the commission record.
    return res.status(201).json({
      success: true,
      message: "Commission generated successfully",
      data: {
        commission,
      },
    });
  } catch (error) {
    // Pass controlled and unexpected errors to the global error handler.
    return next(error);
  }
};

// Retrieve all commissions belonging to the authenticated Agency.
const getAgencyCommissions = async (req, res, next) => {
  try {
    // Retrieve the Agency's commission ledger.
    const commissions =
      await commissionService.getAgencyCommissions(
        req.user._id,
      );

    // Return the ledger.
    return res.status(200).json({
      success: true,
      results: commissions.length,
      data: {
        commissions,
      },
    });
  } catch (error) {
    // Pass errors to the global error handler.
    return next(error);
  }
};

// Retrieve the Agency's commission summary.
const getAgencyCommissionSummary = async (req, res, next) => {
  try {
    // Calculate real summary values from the Agency's commission records.
    const summary =
      await commissionService.getAgencyCommissionSummary(
        req.user._id,
      );

    // Return the summary.
    return res.status(200).json({
      success: true,
      data: {
        summary,
      },
    });
  } catch (error) {
    // Pass errors to the global error handler.
    return next(error);
  }
};

// Update a single Agency commission's payment lifecycle status.
const updateAgencyCommissionStatus = async (req, res, next) => {
  try {
    // Read the requested next status from the request body.
    const { status } = req.body;

    // Restrict the endpoint to known Commission statuses.
    const allowedStatuses = [
      "Processing",
      "Paid",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission status",
      });
    }

    // Update the commission using Agency ownership checks in the service.
    const commission =
      await commissionService.updateAgencyCommissionStatus(
        req.user._id,
        req.params.commissionId,
        status,
      );

    // Return the updated commission.
    return res.status(200).json({
      success: true,
      message: "Commission status updated successfully",
      data: {
        commission,
      },
    });
  } catch (error) {
    // Pass predictable and unexpected errors to the global error handler.
    return next(error);
  }
};

// Run internal payroll for all Agency commissions currently in Processing.
const runAgencyPayroll = async (req, res, next) => {
  try {
    // Mark all Processing Agency commissions as Paid in the internal ledger.
    const payroll =
      await commissionService.runAgencyPayroll(
        req.user._id,
      );

    // Return the payroll result.
    return res.status(200).json({
      success: true,
      message:
        payroll.processedCount > 0
          ? "Agency payroll completed successfully"
          : "No commissions were ready for payroll",
      data: {
        payroll,
      },
    });
  } catch (error) {
    // Pass errors to the centralized error middleware.
    return next(error);
  }
};

// Retrieve all commissions belonging to the authenticated Agent.
const getAgentCommissions = async (req, res, next) => {
  try {
    // Retrieve the Agent's commission ledger.
    const commissions =
      await commissionService.getAgentCommissions(
        req.user._id,
      );

    return res.status(200).json({
      success: true,
      results: commissions.length,
      data: {
        commissions,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Retrieve the authenticated Agent's commission summary.
const getAgentCommissionSummary = async (
  req,
  res,
  next,
) => {
  try {
    // Calculate real summary values from the Agent's commission records.
    const summary =
      await commissionService.getAgentCommissionSummary(
        req.user._id,
      );

    return res.status(200).json({
      success: true,
      data: {
        summary,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  generateCommission,
  getAgencyCommissions,
  getAgencyCommissionSummary,
  updateAgencyCommissionStatus,
  runAgencyPayroll,
  getAgentCommissions,
  getAgentCommissionSummary,
};