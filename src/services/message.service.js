const mongoose = require("mongoose");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const AppError = require("../utils/AppError");
const { getAuthorizedConversation } = require("./conversation.service");
const { toIdString } = require("./communication-context.service");
const eventBus = require("../events/event-bus");
const EVENTS = require("../events/events");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const toMessageResponse = async (message) => {
  await message.populate({ path: "sender", select: "fullName avatar role" });
  const value = message.toObject();
  return {
    ...value,
    sender: String(value.sender._id),
    senderDisplay: {
      userId: String(value.sender._id),
      name: value.sender.fullName,
      avatar: value.sender.avatar || null,
      role: value.sender.role,
    },
  };
};

const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

  return { page, limit, skip: (page - 1) * limit };
};

const validateMessagePayload = (payload = {}) => {
  const type = payload.type || "text";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (type !== "text") {
    throw new AppError("Only text messages are supported at this stage", 400);
  }

  if (!body) {
    throw new AppError("Message body is required", 400);
  }

  if (body.length > 2000) {
    throw new AppError("Message cannot exceed 2000 characters", 400);
  }

  return { type, body };
};

const getMessagesForConversation = async (user, conversationId, query = {}) => {
  const conversation = await getAuthorizedConversation(user, conversationId);
  const { page, limit, skip } = getPagination(query);
  const filter = { conversation: conversation._id };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments(filter),
  ]);

  return {
    messages: await Promise.all(messages.map(toMessageResponse)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      order: "newest_first",
    },
  };
};

const sendMessage = async (user, conversationId, payload = {}) => {
  const conversation = await getAuthorizedConversation(user, conversationId);
  const { type, body } = validateMessagePayload(payload);
  const createdAt = new Date();

  const message = await Message.create({
    conversation: conversation._id,
    sender: user._id,
    kind: type,
    body,
    // A sender has necessarily read the message they have just authored.
    readBy: [{ user: user._id, readAt: createdAt }],
    createdAt,
    updatedAt: createdAt,
  });

  // Preserve the newest successfully created message as conversation preview
  // state.  The conditional prevents an older concurrent request from
  // overwriting a newer message's pointer.
  const updatedConversation = await Conversation.findOneAndUpdate(
    {
      _id: conversation._id,
      $or: [
        { lastMessageAt: { $lte: message.createdAt } },
        { lastMessageAt: null },
      ],
    },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessageId: message._id,
      },
    },
    { new: true },
  );

  if (!updatedConversation) {
    // The message is durable, but failure to update the parent would leave an
    // inconsistent conversation preview.  Remove only the just-created
    // message before surfacing a controlled conflict to the caller.
    await Message.deleteOne({ _id: message._id });
    throw new AppError("Conversation is no longer available", 409);
  }

  const { toConversationResponse } = require("./conversation.service");
  const normalizedMessage = await toMessageResponse(message);
  const normalizedConversation =
    await toConversationResponse(updatedConversation);

  // Realtime is incremental and best-effort. Persistence and the REST
  // response remain successful even when a listener or Socket.IO is offline.
  void eventBus.emitSafe(EVENTS.MESSAGE_CREATED, {
    message: normalizedMessage,
    conversationId: String(updatedConversation._id),
  });

  return { message: normalizedMessage, conversation: normalizedConversation };
};

const syncConversationPreview = async (conversation, message) => {
  const updatedConversation = await Conversation.findOneAndUpdate(
    {
      _id: conversation._id,
      $or: [
        { lastMessageAt: { $lte: message.createdAt } },
        { lastMessageAt: null },
        { lastMessageId: message._id },
      ],
    },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessageId: message._id,
      },
    },
    { new: true },
  );

  return updatedConversation || Conversation.findById(conversation._id);
};

const createEventMessage = async ({
  conversationId,
  senderUserId,
  body,
  context,
  dedupeKey,
}) => {
  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    throw new AppError("A valid conversation ID is required", 400);
  }

  if (!senderUserId || !mongoose.isValidObjectId(senderUserId)) {
    throw new AppError("A valid event sender is required", 400);
  }

  if (typeof body !== "string" || !body.trim()) {
    throw new AppError("Event message body is required", 400);
  }

  if (body.trim().length > 2000) {
    throw new AppError("Event message cannot exceed 2000 characters", 400);
  }

  if (
    !context ||
    typeof context !== "object" ||
    !["property", "inquiry", "booking", "offer", "deal"].includes(context.type)
  ) {
    throw new AppError("A valid event context is required", 400);
  }

  if (!context.resourceId || !mongoose.isValidObjectId(context.resourceId)) {
    throw new AppError("A valid event context resource is required", 400);
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  /*
   * Server-generated events are allowed to originate
   * from an authenticated actor such as an Agent,
   * Finance user, Admin, Buyer, or Owner.
   *

   * The actor does not have to be a participant.
   * For example, Finance may verify a Deal while the
   * conversation itself is Buyer ↔ Agent.
   *
   * The sender is therefore the authenticated actor,
   * while the conversation authorization remains
   * participant-based.
   */

  const normalizedBody = body.trim();

  const normalizedContext = {
    type: context.type,
    resourceId: context.resourceId,
  };

  if (dedupeKey) {
    const existingMessage = await Message.findOne({
      conversation: conversation._id,
      dedupeKey,
    });

    if (existingMessage) {
      const updatedConversation = await syncConversationPreview(
        conversation,
        existingMessage,
      );

      return {
        message: await toMessageResponse(existingMessage),
        conversation: updatedConversation,
        created: false,
      };
    }
  }

  const createdAt = new Date();

  try {
    const message = await Message.create({
      conversation: conversation._id,

      sender: senderUserId,

      kind: "event",

      body: normalizedBody,

      context: normalizedContext,

      dedupeKey: dedupeKey || undefined,

      readBy: [
        {
          user: senderUserId,
          readAt: createdAt,
        },
      ],

      createdAt,

      updatedAt: createdAt,
    });

    const updatedConversation = await syncConversationPreview(
      conversation,
      message,
    );

    if (!updatedConversation) {
      await Message.deleteOne({
        _id: message._id,
      });

      throw new AppError("Conversation is no longer available", 409);
    }

    const normalizedMessage = await toMessageResponse(message);

    const { toConversationResponse } = require("./conversation.service");

    const normalizedConversation =
      await toConversationResponse(updatedConversation);

    void eventBus.emitSafe(EVENTS.MESSAGE_CREATED, {
      message: normalizedMessage,

      conversationId: String(updatedConversation._id),
    });

    return {
      message: normalizedMessage,

      conversation: normalizedConversation,

      created: true,
    };
  } catch (error) {
    if (error?.code === 11000 && dedupeKey) {
      const existingMessage = await Message.findOne({
        conversation: conversation._id,
        dedupeKey,
      });

      if (existingMessage) {
        const updatedConversation = await syncConversationPreview(
          conversation,
          existingMessage,
        );

        return {
          message: await toMessageResponse(existingMessage),

          conversation: updatedConversation,

          created: false,
        };
      }
    }

    throw error;
  }
};

// Internal-only recovery seam for a Contact Agent initial message. The public
// Message API cannot submit its deterministic dedupe key.
const createOrGetInitialMessage = async (
  user,
  conversationId,
  payload = {},
  dedupeKey,
) => {
  if (!dedupeKey) {
    throw new AppError("An initial message dedupe key is required", 400);
  }

  const conversation = await getAuthorizedConversation(user, conversationId);
  const { type, body } = validateMessagePayload(payload);
  const existingMessage = await Message.findOne({
    conversation: conversation._id,
    dedupeKey,
  });

  if (existingMessage) {
    const updatedConversation = await syncConversationPreview(
      conversation,
      existingMessage,
    );
    return {
      message: existingMessage,
      conversation: updatedConversation,
      created: false,
    };
  }

  const createdAt = new Date();
  try {
    const message = await Message.create({
      conversation: conversation._id,
      sender: user._id,
      kind: type,
      body,
      dedupeKey,
      readBy: [{ user: user._id, readAt: createdAt }],
      createdAt,
      updatedAt: createdAt,
    });
    const updatedConversation = await syncConversationPreview(
      conversation,
      message,
    );

    if (!updatedConversation) {
      await Message.deleteOne({ _id: message._id });
      throw new AppError("Conversation is no longer available", 409);
    }

    return { message, conversation: updatedConversation, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const message = await Message.findOne({
        conversation: conversation._id,
        dedupeKey,
      });
      if (message) {
        const updatedConversation = await syncConversationPreview(
          conversation,
          message,
        );
        return { message, conversation: updatedConversation, created: false };
      }
    }
    throw error;
  }
};

const markConversationRead = async (user, conversationId) => {
  const conversation = await getAuthorizedConversation(user, conversationId);
  const userId = toIdString(user);
  const participantState = conversation.participantState.find(
    (state) => toIdString(state.user) === userId,
  );

  if (!participantState) {
    throw new AppError("Conversation participant state is invalid", 409);
  }

  participantState.lastReadAt = new Date();
  await conversation.save();

  return conversation;
};

module.exports = {
  createEventMessage,
  createOrGetInitialMessage,
  getMessagesForConversation,
  markConversationRead,
  sendMessage,
  toMessageResponse,
};
