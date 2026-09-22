const mongoose = require("mongoose");
const Notification = require("../models/notification.model");
const AppError = require("../utils/AppError");
const { createNotificationSchema } = require("../validators/notification.validator");
const { publishNotification } = require("../realtime/socket.service");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

  return { page, limit, skip: (page - 1) * limit };
};

const requireNotificationId = (notificationId) => {
  if (!notificationId || !mongoose.isValidObjectId(notificationId)) {
    throw new AppError("A valid notification ID is required", 400);
  }
};

const validateNotificationPayload = (payload = {}) => {
  const { error, value } = createNotificationSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => detail.message).join(", "),
      400,
    );
  }

  return value;
};

// Internal-only creation seam for the future event dispatcher.  No HTTP route
// exposes this operation, so recipients and resource references remain server
// controlled by calling domain services.
const createOrGetNotification = async (payload = {}) => {
  const value = validateNotificationPayload(payload);

  if (value.dedupeKey) {
    const existing = await Notification.findOne({
      recipient: value.recipient,
      dedupeKey: value.dedupeKey,
    });

    if (existing) {
      return { notification: existing, created: false };
    }
  }

  try {
    const notification = await Notification.create(value);
    // MongoDB is authoritative. Realtime is best-effort delivery only and is
    // intentionally attempted only for a newly persisted notification.
    publishNotification(notification);
    return { notification, created: true };
  } catch (error) {
    if (error?.code === 11000 && value.dedupeKey) {
      const notification = await Notification.findOne({
        recipient: value.recipient,
        dedupeKey: value.dedupeKey,
      });

      if (notification) {
        return { notification, created: false };
      }
    }

    throw error;
  }
};

const listNotifications = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const includeArchived = query.includeArchived === "true";
  const unreadOnly = query.unread === "true";
  const filter = { recipient: user._id };

  if (!includeArchived) {
    filter.archivedAt = null;
  }

  if (unreadOnly) {
    filter.readAt = null;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      order: "newest_first",
    },
  };
};

const getUnreadCount = async (user) => {
  const unreadCount = await Notification.countDocuments({
    recipient: user._id,
    readAt: null,
    archivedAt: null,
  });

  return { unreadCount };
};

const getRecipientNotification = async (user, notificationId) => {
  requireNotificationId(notificationId);

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: user._id,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  return notification;
};

const markNotificationRead = async (user, notificationId) => {
  const notification = await getRecipientNotification(user, notificationId);

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

const markAllNotificationsRead = async (user) => {
  const readAt = new Date();
  const result = await Notification.updateMany(
    {
      recipient: user._id,
      archivedAt: null,
      readAt: null,
    },
    { $set: { readAt } },
  );

  return { modifiedCount: result.modifiedCount, readAt };
};

const archiveNotification = async (user, notificationId) => {
  const notification = await getRecipientNotification(user, notificationId);

  if (!notification.archivedAt) {
    notification.archivedAt = new Date();
    await notification.save();
  }

  return notification;
};

module.exports = {
  archiveNotification,
  createOrGetNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
};
