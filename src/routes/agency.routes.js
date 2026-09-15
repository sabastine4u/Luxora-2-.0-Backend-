const router = require("express").Router();

const agencyController = require("../controllers/agency.controller");

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const { ROLES } = require("../config/constants");

// GET /api/v1/agencies/me
// Allows an authenticated Agency user to retrieve its own business profile.
router.get(
  "/agencies/me",
  protect,
  restrictTo(ROLES.AGENCY),
  agencyController.getMyAgency,
);

// PATCH /api/v1/agencies/me
// Allows an authenticated Agency user to update its own business profile.
router.patch(
  "/agencies/me",
  protect,
  restrictTo(ROLES.AGENCY),
  agencyController.updateMyAgency,
);

// POST /api/v1/agencies
// Only Admin/Super Admin can provision a new Agency account.
router.post(
  "/agencies",
  protect,
  restrictTo(ROLES.ADMIN),
  agencyController.createAgency,
);

module.exports = router;