const notificationService = require("../services/notification.service");
const api = require("../utils/api-response");

exports.listNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications(req.user, req.query);
    return api.success(res, result, "Notifications retrieved successfully");
  } catch (error) {
    return next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user);
    return api.success(res, result, "Notification unread count retrieved successfully");
  } catch (error) {
    return next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationRead(
      req.user,
      req.params.notificationId,
    );
    return api.success(res, { notification }, "Notification marked as read");
  } catch (error) {
    return next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user);
    return api.success(res, result, "Notifications marked as read");
  } catch (error) {
    return next(error);
  }
};

exports.archiveNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.archiveNotification(
      req.user,
      req.params.notificationId,
    );
    return api.success(res, { notification }, "Notification archived successfully");
  } catch (error) {
    return next(error);
  }
};
