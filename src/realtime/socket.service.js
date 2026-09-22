const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const FRONTEND_ORIGIN = "http://localhost:5173";
let io;

const getUserRoom = (userId) => `user:${String(userId)}`;

const toNotificationPayload = (notification) => {
  const value = notification.toObject ? notification.toObject() : notification;

  return {
    id: String(value._id),
    type: value.type,
    category: value.category,
    priority: value.priority,
    title: value.title,
    body: value.body,
    actor: value.actor ? String(value.actor) : null,
    resourceType: value.resourceType,
    resourceId: value.resourceId ? String(value.resourceId) : null,
    property: value.property ? String(value.property) : null,
    inquiry: value.inquiry ? String(value.inquiry) : null,
    booking: value.booking ? String(value.booking) : null,
    offer: value.offer ? String(value.offer) : null,
    conversation: value.conversation ? String(value.conversation) : null,
    message: value.message ? String(value.message) : null,
    createdAt: value.createdAt,
    readAt: value.readAt,
  };
};

const initializeSocketServer = (httpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id isActive");

      if (!user || !user.isActive) {
        return next(new Error("Authentication failed"));
      }

      socket.data.userId = String(user._id);
      return next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        return next(new Error("Authentication failed"));
      }

      return next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(getUserRoom(socket.data.userId));
    socket.on("disconnect", (reason) => {
      console.info(`Realtime socket disconnected for user ${socket.data.userId}: ${reason}`);
    });
  });

  return io;
};

const publishNotification = (notification) => {
  if (!io) {
    console.warn("Realtime notification delivery skipped: Socket.IO is not initialized");
    return false;
  }

  try {
    const value = notification.toObject ? notification.toObject() : notification;
    if (!value?.recipient) {
      throw new Error("Persisted notification recipient is required for realtime delivery");
    }

    io.to(getUserRoom(value.recipient)).emit(
      "notification:new",
      toNotificationPayload(value),
    );
    return true;
  } catch (error) {
    console.error("Realtime notification delivery failed:", error);
    return false;
  }
};

module.exports = {
  getUserRoom,
  initializeSocketServer,
  publishNotification,
};
