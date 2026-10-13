
const router = require("express").Router();

const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const {
  uploadUserAvatar,
} = require("../middleware/upload.middleware");

// Public registration and authentication.
router.post("/register", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post(
  "/resend-verification",
  authController.resendVerification,
);
router.post("/login", authController.login);

// Authenticated account routes.
router.get("/me", protect, authController.getMe);

router.patch(
  "/profile",
  protect,
  authController.updateProfile,
);

router.patch(
  "/profile/photo",
  protect,
  uploadUserAvatar,
  authController.updateProfilePhoto,
);

router.post(
  "/logout",
  protect,
  authController.logout,
);

router.patch(
  "/change-password",
  protect,
  authController.changePassword,
);

module.exports = router;
