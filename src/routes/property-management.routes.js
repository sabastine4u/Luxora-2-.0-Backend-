const express = require("express");
const controller = require("../controllers/property-management.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const router = express.Router();
router.use(protect, restrictTo(ROLES.PROPERTY_MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN));
router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return next(new AppError("Invalid record ID", 400));
  return next();
});

router.get("/property-management/properties", controller.getPortfolioProperties);
router.get("/property-management/summary", controller.getSummary);
router.get("/property-management/analytics", controller.getAnalytics);
router.get("/property-management/documents", controller.getDocuments);

router.route("/property-management/tenants").get(controller.listTenants).post(controller.createTenant);
router.route("/property-management/tenants/:id").get(controller.getTenant).patch(controller.updateTenant);
router.route("/property-management/leases").get(controller.listLeases).post(controller.createLease);
router.route("/property-management/leases/:id").get(controller.getLease).patch(controller.updateLease);
router.patch("/property-management/leases/:id/renew", controller.renewLease);
router.patch("/property-management/leases/:id/terminate", controller.terminateLease);

router.route("/property-management/work-orders").get(controller.listWorkOrders).post(controller.createWorkOrder);
router.patch("/property-management/work-orders/bulk-assign", controller.bulkAssignWorkOrders);
router.route("/property-management/work-orders/:id").get(controller.getWorkOrder).patch(controller.updateWorkOrder);
router.patch("/property-management/work-orders/:id/assign", controller.assignWorkOrder);
router.patch("/property-management/work-orders/:id/status", controller.updateWorkOrderStatus);

router.route("/property-management/inspections").get(controller.listInspections).post(controller.createInspection);
router.route("/property-management/inspections/:id").get(controller.getInspection).patch(controller.updateInspection);
router.patch("/property-management/inspections/:id/complete", controller.completeInspection);

router.route("/property-management/payments").get(controller.listPayments);
router.route("/property-management/payments/:id").get(controller.getPayment);
router.patch("/property-management/payments/:id/status", controller.updatePaymentStatus);

router.route("/property-management/expenses").get(controller.listExpenses).post(controller.createExpense);
router.route("/property-management/expenses/:id").get(controller.getExpense).patch(controller.updateExpense);
router.patch("/property-management/expenses/:id/approve", controller.approveExpense);
router.route("/property-management/income").get(controller.listIncome).post(controller.createIncome);
router.route("/property-management/income/:id").get(controller.getIncome).patch(controller.updateIncome);

module.exports = router;
