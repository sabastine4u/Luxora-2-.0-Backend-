const router = require("express").Router();

const adminController = require("../controllers/admin.controller");

const complaintController = require("../controllers/complaint.controller");

const { protect, restrictTo } = require("../middleware/auth.middleware");

const { ROLES } = require("../config/constants");

const financeController = require("../controllers/finance.controller");





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

// Allow Admin/Super Admin to edit an existing Agency.
router.patch(
  "/admin/agencies/:id",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateAgency,
);


// Return the six Internal Staff roles for Admin/Super Admin management.
router.get(
  "/admin/internal-staff",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllInternalStaff,
);

// PATCH /api/v1/admin/internal-staff/:id
// Allows Admin/Super Admin to edit an Internal Staff account.
router.patch(
  "/admin/internal-staff/:id",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateInternalStaff,
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

// Allow Admin/Super Admin to edit an existing Buyer profile.
router.patch(
  "/admin/buyers/:id",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateBuyer,
);

// Allow Admin/Super Admin to suspend or reactivate a Buyer account.
router.patch(
  "/admin/buyers/:id/status",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateBuyerStatus,
);

router.get(
  "/admin/owners",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllOwners,
);


// Return every Property for Admin/Super Admin listing management.
router.get(
  "/admin/properties",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.getAllProperties,
);

// Allow Admin/Super Admin to suspend or reactivate an Agent.
router.patch(
  "/admin/agents/:id/status",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateAgentStatus,
);

// Allow Admin/Super Admin to edit an Agent profile.
router.patch(
  "/admin/agents/:id",
  protect,
  restrictTo(ROLES.ADMIN),
  adminController.updateAgent,
);

// GET /api/v1/admin/system-settings
// Returns the global Luxora platform configuration.
router.get(
  "/admin/system-settings",
  protect,
  restrictTo(ROLES.SUPER_ADMIN),
  adminController.getSystemSettings,
);

router.patch(
  "/admin/system-settings",
  protect,
  restrictTo(ROLES.SUPER_ADMIN),
  adminController.updateSystemSettings,
);

router.get(
  "/admin/finance/summary",
  protect,
  restrictTo(ROLES.ADMIN),
  financeController.getAdminFinanceSummary,
);

router.get(
  "/admin/complaints",
  protect,
  restrictTo(ROLES.ADMIN),
  complaintController.getAdminComplaints,
);
router.patch(
  "/admin/complaints/:id/status",
  protect,
  restrictTo(ROLES.ADMIN),
  complaintController.updateComplaintStatus,
);


module.exports = router;
