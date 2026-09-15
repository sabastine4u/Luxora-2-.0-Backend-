const express = require("express");

const homeServicesController = require(
  "../controllers/home-services.controller",
);

const {
  protect,
  restrictTo,
} = require("../middleware/auth.middleware");

const {
  ROLES,
} = require("../config/constants");

const router = express.Router();

router.use(
  protect,
  restrictTo(
    ROLES.SERVICE_ADMIN,
  ),
);

router.get(
  "/home-services/overview",
  homeServicesController.getOverview,
);

router.get(
  "/home-services/requests",
  homeServicesController.getServiceRequests,
);

router.post(
  "/home-services/requests",
  homeServicesController.createServiceRequest,
);

router.patch(
  "/home-services/requests/:requestId/assign",
  homeServicesController.assignServiceRequest,
);

router.patch(
  "/home-services/requests/:requestId/reject",
  homeServicesController.rejectServiceRequest,
);

router.get(
  "/home-services/providers",
  homeServicesController.getServiceProviders,
);

router.post(
  "/home-services/providers",
  homeServicesController.createServiceProvider,
);

router.patch(
  "/home-services/providers/:providerId/approve",
  homeServicesController.approveServiceProvider,
);

router.patch(
  "/home-services/providers/:providerId/suspend",
  homeServicesController.suspendServiceProvider,
);


router.get(
  "/home-services/bookings",
  homeServicesController.getServiceBookings,
);

router.patch(
  "/home-services/bookings/:bookingId/status",
  homeServicesController.updateServiceBookingStatus,
);

router.post(
  "/home-services/requests/:requestId/bookings",
  homeServicesController.createBookingFromRequest,
);

router.get(
  "/home-services/categories",
  homeServicesController.getServiceCategories,
);

router.post(
  "/home-services/categories",
  homeServicesController.createServiceCategory,
);

router.patch(
  "/home-services/categories/:categoryId",
  homeServicesController.updateServiceCategory,
);

router.patch(
  "/home-services/categories/:categoryId/toggle",
  homeServicesController.toggleServiceCategory,
);

router.get(
  "/home-services/financials",
  homeServicesController.getFinancials,
);


router.post(
  "/home-services/bookings/:bookingId/financials",
  homeServicesController.createRevenueTransactionFromBooking,
);

router.get(
  "/home-services/analytics",
  homeServicesController.getAnalytics,
);

router.get(
  "/home-services/settings",
  homeServicesController.getHomeServicesSettings,
);

router.patch(
  "/home-services/settings",
  homeServicesController.updateHomeServicesSettings,
);

module.exports = router;