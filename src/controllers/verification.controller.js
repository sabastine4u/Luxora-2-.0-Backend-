// Import the Verification service that contains the business logic.
const verificationService = require('../services/verification.service');

// Import the centralized API response helper.
const api = require('../utils/api-response');


// GET /api/v1/admin/verification-center/summary
// Return real aggregate Verification Center totals for the dashboard.
exports.getVerificationCenterSummary = async (req, res, next) => {
  try {
    // Ask the service for the current counts of every verification state.
    const summary =
      await verificationService.getVerificationCenterSummary();

    // Return the real summary to the Admin/Super Admin dashboard.
    return api.success(
      res,
      { summary },
      'Verification Center summary retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};
// GET /api/v1/admin/verification-center/count
// Return the real number of pending Agent verification requests.
exports.getVerificationCenterCount = async (req, res, next) => {
  try {
    // Ask the service to calculate the current pending verification count.
    const count =
      await verificationService.getVerificationCenterCount();

    // Return the count to the Admin/Super Admin dashboard.
    return api.success(
      res,
      { count },
      'Verification Center count retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};
// GET /api/v1/admin/verification-center
// Return Verification records for the selected Verification Center tab.
exports.getVerificationCenterQueue = async (req, res, next) => {
  try {
    // Read the requested verification status from the query string.
    const { status } = req.query;

    // Ask the service for the records belonging to that status.
    const verifications =
      await verificationService.getVerificationCenterQueue(
        status
      );

    // Return the real records to the Verification Center.
    return api.success(
      res,
      { verifications },
      'Verification Center records retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// GET /api/v1/admin/verification-center/:agentId
// Return complete verification details for one Agent.
exports.getVerificationCenterDetails = async (req, res, next) => {
  try {
    // Ask the service for the selected Agent's verification record.
    const verification =
      await verificationService.getVerificationCenterDetails(
        req.params.agentId
      );

    // Return the populated verification details to the frontend.
    return api.success(
      res,
      { verification },
      'Verification details retrieved successfully'
    );
  } catch (error) {
    // Pass expected and unexpected errors to the global error handler.
    next(error);
  }
};

// PATCH /api/v1/admin/verification-center/:agentId/review
// Approve or reject one Agent verification request.
exports.reviewVerification = async (req, res, next) => {
  try {
    // Read the review decision and notes submitted by the Admin.
    const {
      decision,
      reviewNotes = '',
    } = req.body;

    // Delegate all verification business rules to the service.
    const result =
      await verificationService.reviewVerification({
        agentId: req.params.agentId,
        reviewerId: req.user._id,
        decision,
        reviewNotes,
      });

    // Return the updated verification workflow records.
    return api.success(
      res,
      result,
      `Agent verification ${decision.toLowerCase()} successfully`
    );
  } catch (error) {
    // Pass expected and unexpected errors to the global error handler.
    next(error);
  }
};