const router = require("express").Router();

const adminController = require("../controllers/admin.controller");

const { protect, restrictTo } = require("../middleware/auth.middleware");

const { ROLES } = require("../config/constants");

// Allow logged-in Admins to access platform management data.
// Super Admin automatically passes through the existing restrictTo bypass.
router.get(
  "/admin/agents",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllAgents,
);

// Return all Agencies for Admin/Super Admin management.
router.get(
  "/admin/agencies",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllAgencies,
);


// Return the six Internal Staff roles for Admin/Super Admin management.
router.get(
  "/admin/internal-staff",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllInternalStaff,
);

// Allow Admin/Super Admin to verify or unverify an Internal Staff account.
router.patch(
  "/admin/internal-staff/:id/verification",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateInternalStaffVerification,
);

// Return all Admin accounts for Super Admin management.
router.get(
  "/admin/admins",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllAdmins,
);

router.get(
  "/admin/buyers",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllBuyers,
);
router.get(
  "/admin/owners",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllOwners,
);



module.exports = router;
