const router = require("express").Router();
const procurementController = require("../controllers/procurement.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");

// Like Home Services, this router is mounted at /api/v1. Keep its guard
// within the procurement namespace so future sibling routers are isolated.
router.use("/procurement", protect, restrictTo(ROLES.PROCUREMENT, ROLES.ADMIN, ROLES.SUPER_ADMIN));
router.get("/procurement/overview", procurementController.getOverview);
router.get("/procurement/reports", procurementController.getReport);
router.get("/procurement/counts", procurementController.getCounts);
router.get("/procurement/:recordType", procurementController.list);
router.post("/procurement/:recordType", procurementController.create);
router.patch("/procurement/:recordType/:recordId", procurementController.update);

module.exports = router;
