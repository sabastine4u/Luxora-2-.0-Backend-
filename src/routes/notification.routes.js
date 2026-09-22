const express = require("express");
const notificationController = require("../controllers/notification.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get("/", notificationController.listNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllNotificationsRead);
router.patch("/:notificationId/read", notificationController.markNotificationRead);
router.patch("/:notificationId/archive", notificationController.archiveNotification);

module.exports = router;
