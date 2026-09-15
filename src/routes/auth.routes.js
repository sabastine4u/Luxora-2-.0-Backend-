const router = require("express").Router();
const authController = require("../controllers/auth.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { ROLES } = require("../config/constants");

// Import the middleware responsible for authenticated profile-picture uploads.
const { uploadUserAvatar } = require("../middleware/upload.middleware");


router.post("/register", authController.register);
router.post("/login", authController.login);

router.get("/me", protect, authController.getMe);

// Allows the authenticated user to update their own profile.
router.patch("/profile", protect, authController.updateProfile);

// Allow an authenticated user to replace their profile picture.
router.patch(
  "/profile/photo",
  protect,
  uploadUserAvatar,
  authController.updateProfilePhoto,
);


router.post("/logout", protect, authController.logout);

router.patch("/change-password", protect, authController.changePassword);


module.exports = router;

