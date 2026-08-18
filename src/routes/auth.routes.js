const router = require("express").Router();
const authController = require("../controllers/auth.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");


router.post("/register", authController.register);
router.post("/login", authController.login);

router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);

router.patch("/change-password", protect, authController.changePassword);


module.exports = router;

