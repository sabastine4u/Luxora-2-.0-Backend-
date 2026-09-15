// Import the Approval service that contains the Property approval business logic.
const approvalService = require('../services/approval.service');

// Import the centralized API response helper used across the backend.
const api = require('../utils/api-response');

// Submit a Property to the approval/review workflow.
exports.submitPropertyForReview = async (req, res, next) => {
  try {
    // Send the Property ID and authenticated User to the approval service.
    const result = await approvalService.submitPropertyForReview(
      req.params.propertyId,
      req.user,
    );

    // Return the updated Property and Approval records after successful submission.
    return api.success(
      res,
      result,
      'Property submitted for review successfully',
    );
  } catch (error) {
    // Pass service and unexpected errors to the centralized error handler.
    next(error);
  }
};

// Approve or reject a pending Property approval request.
exports.reviewPropertyApproval = async (req, res, next) => {
  try {
    // Extract the review decision and optional notes from the request body.
    const { decision, reviewNotes } = req.body;

    // Send the Property ID, authenticated reviewer, and decision to the service.
    const result = await approvalService.reviewPropertyApproval(
      req.params.propertyId,
      req.user,
      decision,
      reviewNotes,
    );

    // Return the updated Property and Approval records after review.
    return api.success(
      res,
      result,
      `Property ${decision.toLowerCase()} successfully`,
    );
  } catch (error) {
    // Pass service and unexpected errors to the centralized error handler.
    next(error);
  }
};


// Publish an approved Property to the public Luxora marketplace.
exports.publishProperty = async (req, res, next) => {
  try {
    // Send the Property ID and authenticated reviewer to the publishing service.
    const property = await approvalService.publishProperty(
      req.params.propertyId,
      req.user,
    );

    // Return the newly published Property using the standard API response format.
    return api.success(
      res,
      { property },
      'Property published successfully',
    );
  } catch (error) {
    // Pass service and unexpected errors to the centralized error handler.
    next(error);
  }
};