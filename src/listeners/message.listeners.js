const Conversation = require("../models/conversation.model");
const EVENTS = require("../events/events");
const { publishMessage } = require("../realtime/socket.service");

const handleMessageCreated = async ({ message, conversationId } = {}) => {
  if (!message?._id || !conversationId || String(message.conversation) !== String(conversationId)) {
    throw new Error("MESSAGE_CREATED requires a normalized message for its conversation");
  }

  // The persisted conversation is the sole recipient authority. A client
  // cannot select recipients or rooms through this event.
  const conversation = await Conversation.findById(conversationId)
    .select("participants")
    .lean();
  if (!conversation) {
    throw new Error("MESSAGE_CREATED conversation no longer exists");
  }

  publishMessage({
    message,
    conversationId: conversation._id,
    recipientUserIds: conversation.participants.map(String),
  });
};

const registerMessageListeners = (eventBus) => {
  eventBus.register(EVENTS.MESSAGE_CREATED, handleMessageCreated);
};

module.exports = { registerMessageListeners };
