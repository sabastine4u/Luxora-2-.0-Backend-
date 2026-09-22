const mongoose = require("mongoose");
const Conversation = require("../models/conversation.model");
const AppError = require("../utils/AppError");
const { COMMUNICATION } = require("../config/constants");
const {
  assertConversationParticipant,
  authorizeAuthenticatedInquiryConversationCreation,
  authorizeInquiryCommunication,
} = require("./communication-authorization.service");
const { toIdString } = require("./communication-context.service");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

  return { page, limit, skip: (page - 1) * limit };
};

const requireConversationId = (conversationId) => {
  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    throw new AppError("A valid conversation ID is required", 400);
  }
};

const getAuthorizedConversation = async (user, conversationId) => {
  requireConversationId(conversationId);

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  assertConversationParticipant(user, conversation.participants);

  if (conversation.type === COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY) {
    const context = await authorizeInquiryCommunication(user, conversation.inquiry);

    // The context service may recognize an Owner as business context.  This
    // phase deliberately requires actual participant membership to expose the
    // thread itself.
    if (!context.isConversationParticipant) {
      throw new AppError(
        "You do not have permission to access this conversation",
        403,
      );
    }
  }

  return conversation;
};

const createPropertyInquiryConversation = async (user, inquiryId) => {
  const context = await authorizeAuthenticatedInquiryConversationCreation(
    user,
    inquiryId,
  );

  const existingConversation = await Conversation.findOne({
    type: COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY,
    inquiry: context.inquiry._id,
    status: COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
  });

  if (existingConversation) {
    return { conversation: existingConversation, created: false };
  }

  const participants = context.conversationParticipantUserIds;
  const now = new Date();

  try {
    const conversation = await Conversation.create({
      type: COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY,
      inquiry: context.inquiry._id,
      property: context.propertyId,
      participants,
      participantState: participants.map((participant) => ({ user: participant })),
      createdBy: user._id,
      status: COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
      lastMessageAt: now,
    });

    return { conversation, created: true };
  } catch (error) {
    // The partial unique index is the concurrency protection for two valid
    // requests that both pass the initial lookup.
    if (error?.code === 11000) {
      const conversation = await Conversation.findOne({
        type: COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY,
        inquiry: context.inquiry._id,
        status: COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
      });

      if (conversation) {
        return { conversation, created: false };
      }
    }

    throw error;
  }
};

const createConversation = async (user, payload = {}) => {
  if (payload.type !== COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY) {
    throw new AppError(
      "Only property inquiry conversations are supported at this stage",
      400,
    );
  }

  return createPropertyInquiryConversation(user, payload.inquiryId);
};

const getConversationsForUser = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const includeArchived = query.includeArchived === "true";
  const filter = { participants: user._id };

  if (!includeArchived) {
    filter.participantState = {
      $not: {
        $elemMatch: {
          user: user._id,
          archivedAt: { $ne: null },
        },
      },
    };
  }

  // Membership alone is not sufficient for a business-context conversation:
  // the Inquiry relationship must still authorize the user.  Filtering before
  // paging prevents a stale participant entry from leaking inbox metadata.
  const candidateConversations = await Conversation.find(filter).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });

  const accessResults = await Promise.all(
    candidateConversations.map(async (conversation) => {
      if (conversation.type !== COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY) {
        return { conversation, allowed: true };
      }

      try {
        const context = await authorizeInquiryCommunication(user, conversation.inquiry);
        return { conversation, allowed: context.isConversationParticipant };
      } catch (_error) {
        // Inbox enumeration must not reveal a thread that has lost its
        // business-context authorization.
        return { conversation, allowed: false };
      }
    }),
  );

  const authorizedConversations = accessResults
    .filter((result) => result.allowed)
    .map((result) => result.conversation);
  const total = authorizedConversations.length;
  const conversations = authorizedConversations.slice(skip, skip + limit);

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const archiveConversationForUser = async (user, conversationId) => {
  const conversation = await getAuthorizedConversation(user, conversationId);
  const userId = toIdString(user);
  const state = conversation.participantState.find(
    (participantState) => toIdString(participantState.user) === userId,
  );

  if (!state) {
    throw new AppError("Conversation participant state is invalid", 409);
  }

  if (!state.archivedAt) {
    state.archivedAt = new Date();
    await conversation.save();
  }

  return conversation;
};

const unarchiveConversationForUser = async (user, conversationId) => {
  const conversation = await getAuthorizedConversation(user, conversationId);
  const userId = toIdString(user);
  const state = conversation.participantState.find(
    (participantState) => toIdString(participantState.user) === userId,
  );

  if (!state) {
    throw new AppError("Conversation participant state is invalid", 409);
  }

  if (state.archivedAt) {
    state.archivedAt = null;
    await conversation.save();
  }

  return conversation;
};

module.exports = {
  archiveConversationForUser,
  createConversation,
  getAuthorizedConversation,
  getConversationsForUser,
  unarchiveConversationForUser,
};
