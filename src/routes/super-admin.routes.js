const router = require("express").Router();
const controller = require("../controllers/super-admin.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");

router.get("/overview", protect, restrictTo(ROLES.SUPER_ADMIN), controller.getOverview);
router.get("/counts", protect, restrictTo(ROLES.SUPER_ADMIN), controller.getCounts);
module.exports = router;
