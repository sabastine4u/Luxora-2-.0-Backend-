const router = require('express').Router();

const verificationController = require('../controllers/verification.controller');

const {
  protect,
  restrictTo,
} = require('../middleware/auth.middleware');

const { ROLES } = require('../config/constants');

// Return the real number of pending Agent verification requests.
router.get(
  '/admin/verification-center/count',
  protect,
  restrictTo(ROLES.ADMIN),
  verificationController.getVerificationCenterCount,
);

// Return real aggregate totals for the Verification Center dashboard.
router.get(
  '/admin/verification-center/summary',
  protect,
  restrictTo(ROLES.ADMIN),
  verificationController.getVerificationCenterSummary,
);
// Return all pending Agent verification requests.
router.get(
  '/admin/verification-center',
  protect,
  restrictTo(ROLES.ADMIN),
  verificationController.getVerificationCenterQueue,
);

// Return the complete verification details for one Agent.
router.get(
  '/admin/verification-center/:agentId',
  protect,
  restrictTo(ROLES.ADMIN),
  verificationController.getVerificationCenterDetails,
);

// Approve or reject an Agent verification request.
router.patch(
  '/admin/verification-center/:agentId/review',
  protect,
  restrictTo(ROLES.ADMIN),
  verificationController.reviewVerification,
);

module.exports = router;