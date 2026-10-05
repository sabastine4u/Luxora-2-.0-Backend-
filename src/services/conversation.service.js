const mongoose = require("mongoose");
const Conversation = require("../models/conversation.model");
const User = require("../models/user.model");
const Agent = require("../models/agent.model");
const Inquiry = require("../models/inquiry.model");
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

// Escape user-provided text before using it inside a MongoDB regex.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a deterministic key for a one-to-one conversation.
 *
 * The same two users always generate the same key regardless
 * of which participant starts the conversation.
 */
const buildDirectKey = (leftUserId, rightUserId) =>
  [String(leftUserId), String(rightUserId)].sort().join(":");

const toParticipantDisplay = (user) => ({
  userId: String(user._id),
  name: user.fullName,
  avatar: user.avatar || null,
  role: user.role,
});

const toConversationResponse = async (conversation) => {
  await conversation.populate({
    path: "participants",
    select: "fullName avatar role",
  });

  const value = conversation.toObject();

  return {
    ...value,
    participants: value.participants.map((participant) =>
      String(participant._id),
    ),
    participantDisplays: conversation.participants.map(toParticipantDisplay),
  };
};

const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || DEFAULT_PAGE, 1);

  const requestedLimit =
    Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;

  const limit = Math.min(
    Math.max(requestedLimit, 1),
    MAX_LIMIT,
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const requireConversationId = (conversationId) => {
  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    throw new AppError("A valid conversation ID is required", 400);
  }
};

/**
 * Restores a direct conversation for the initiating
 * participant when it has previously been archived.
 *
 * Archive state is participant-specific, so this only
 * changes the authenticated user's state.
 */
const restoreDirectConversationForUser = async (
  conversation,
  userId,
) => {
  let changed = false;

  if (
    conversation.status !==
    COMMUNICATION.CONVERSATION_STATUSES.ACTIVE
  ) {
    conversation.status =
      COMMUNICATION.CONVERSATION_STATUSES.ACTIVE;

    changed = true;
  }

  const participantState = conversation.participantState.find(
    (state) => toIdString(state.user) === String(userId),
  );

  if (participantState && participantState.archivedAt) {
    participantState.archivedAt = null;

    changed = true;
  }

  if (changed) {
    await conversation.save();
  }

  return conversation;
};

/**
 * Finds the persistent one-to-one conversation for two users.
 *
 * directKey is the authoritative lookup.
 *
 * The participant fallback supports conversations created
 * before directKey was introduced and upgrades them safely.
 */
const findDirectConversation = async (
  leftUserId,
  rightUserId,
) => {
  const directKey = buildDirectKey(
    leftUserId,
    rightUserId,
  );

  let conversation = await Conversation.findOne({
    type: COMMUNICATION.CONVERSATION_TYPES.DIRECT,
    directKey,
  }).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });

  if (conversation) {
    return conversation;
  }

  /*
   * Backward-compatible lookup for older Direct
   * conversations that were created before directKey.
   */
  const participants = [
    leftUserId,
    rightUserId,
  ].sort((left, right) =>
    String(left).localeCompare(String(right)),
  );

  conversation = await Conversation.findOne({
    type: COMMUNICATION.CONVERSATION_TYPES.DIRECT,
    participants: {
      $all: participants,
      $size: 2,
    },
  }).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });

  if (!conversation) {
    return null;
  }

  /*
   * Upgrade the legacy conversation so future lookups
   * use the deterministic directKey.
   */
  conversation.directKey = directKey;

  try {
    await conversation.save();
  } catch (error) {
    /*
     * Another concurrent request may have upgraded the
     * same user pair first.
     */
    if (error?.code === 11000) {
      const keyedConversation = await Conversation.findOne({
        type: COMMUNICATION.CONVERSATION_TYPES.DIRECT,
        directKey,
      }).sort({
        lastMessageAt: -1,
        updatedAt: -1,
      });

      if (keyedConversation) {
        return keyedConversation;
      }
    }

    throw error;
  }

  return conversation;
};

/**
 * Shared internal primitive for every feature that needs
 * a one-to-one conversation:
 *
 * Buyer ↔ Agent
 * Buyer ↔ Agency
 * Agency ↔ Agent
 * Admin ↔ Agent
 * etc.
 *
 * No business context is stored here. Business context is
 * represented by messages/events inside the conversation.
 */
const getOrCreateDirectConversation = async (
  leftUserId,
  rightUserId,
) => {
  if (
    !leftUserId ||
    !rightUserId ||
    String(leftUserId) === String(rightUserId)
  ) {
    throw new AppError(
      "Two different users are required for a direct conversation",
      400,
    );
  }

  const directKey = buildDirectKey(
    leftUserId,
    rightUserId,
  );

  let conversation = await findDirectConversation(
    leftUserId,
    rightUserId,
  );

  if (conversation) {
    return restoreDirectConversationForUser(
      conversation,
      leftUserId,
    );
  }

  const participants = [
    leftUserId,
    rightUserId,
  ].sort((left, right) =>
    String(left).localeCompare(String(right)),
  );

  try {
    conversation = await Conversation.create({
      type: COMMUNICATION.CONVERSATION_TYPES.DIRECT,
      directKey,
      participants,
      participantState: participants.map(
        (participant) => ({
          user: participant,
        }),
      ),
      createdBy: leftUserId,
      status:
        COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
    });

    return conversation;
  } catch (error) {
    /*
     * The unique directKey index protects against
     * simultaneous creation attempts.
     */
    if (error?.code === 11000) {
      conversation = await findDirectConversation(
        leftUserId,
        rightUserId,
      );

      if (conversation) {
        return restoreDirectConversationForUser(
          conversation,
          leftUserId,
        );
      }
    }

    throw error;
  }
};

const getAuthorizedConversation = async (
  user,
  conversationId,
) => {
  requireConversationId(conversationId);

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  assertConversationParticipant(
    user,
    conversation.participants,
  );

  /*
   * Legacy property-inquiry conversations still need
   * business-context authorization.
   *
   * New conversations created from inquiries are DIRECT,
   * so their authorization is ordinary participant access.
   */
  if (
    conversation.type ===
    COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY
  ) {
    const context =
      await authorizeInquiryCommunication(
        user,
        conversation.inquiry,
      );

    if (!context.isConversationParticipant) {
      throw new AppError(
        "You do not have permission to access this conversation",
        403,
      );
    }
  }

  return conversation;
};

/**
 * Creates or reuses the persistent one-to-one conversation
 * for a property inquiry.
 *
 * The inquiry is a business event/context and does not
 * define the identity of the conversation.
 */
const createPropertyInquiryConversation = async (
  user,
  inquiryId,
) => {
  const context =
    await authorizeAuthenticatedInquiryConversationCreation(
      user,
      inquiryId,
    );

  /*
   * Prefer the assigned Agent as the messaging recipient.
   * Fall back to the Agency when no Agent is available.
   */
  const recipientUserId =
    context.agentUserId ||
    context.agencyUserId;

  if (!recipientUserId) {
    throw new AppError(
      "This inquiry has no available messaging recipient",
      409,
    );
  }

  if (
    String(recipientUserId) ===
    String(user._id)
  ) {
    throw new AppError(
      "A conversation recipient must be different from the requester",
      400,
    );
  }

  /*
   * The shared direct-conversation helper guarantees
   * that the inquiry reuses the same Buyer ↔ Agent or
   * Buyer ↔ Agency thread.
   */
  const conversation =
    await getOrCreateDirectConversation(
      user._id,
      recipientUserId,
    );

  return {
    conversation,
    created:
      !conversation.lastMessageAt &&
      conversation.createdBy &&
      String(conversation.createdBy) ===
        String(user._id),
  };
};

/**
 * Creates or reuses a Direct conversation between the
 * authenticated Agent and one of the Agent's Clients.
 *
 * IMPORTANT:
 * The frontend supplies only the Client email.
 * The actual Luxora User ID is resolved here on the server
 * from the Agent's own Inquiry relationship.
 */
const createAgentClientConversation = async (
  user,
  clientEmail,
) => {
  // Only authenticated Agents can use this workflow.
  if (!user?._id || user.role !== "Agent") {
    throw new AppError(
      "Only an authenticated Agent can message Clients",
      403,
    );
  }

  if (
    typeof clientEmail !== "string" ||
    !clientEmail.trim()
  ) {
    throw new AppError(
      "A Client email is required",
      400,
    );
  }

  // Normalize the email so casing/extra spaces do not affect the lookup.
  const normalizedEmail =
    clientEmail.trim().toLowerCase();

  // Resolve the Agent profile belonging to the authenticated User.
  const agent = await Agent.findOne({
    user: user._id,
  }).select("_id status");

  if (!agent) {
    throw new AppError(
      "Agent profile not found for the authenticated user",
      404,
    );
  }

  // Do not allow inactive Agents to initiate Client communication.
  if (agent.status !== "Active") {
    throw new AppError(
      "The Agent account is not active",
      403,
    );
  }

  /*
   * Find this Agent's real inquiries matching the requested
   * Client email.
   *
   * We require an authenticated `inquirer`, because an
   * anonymous inquiry does not have a Luxora User account
   * that can participate in a conversation.
   */
  const matchingInquiries =
    await Inquiry.find({
      agent: agent._id,

      email: {
        $regex: `^${escapeRegex(normalizedEmail)}$`,
        $options: "i",
      },

      inquirer: {
        $ne: null,
      },
    })
      .sort({
        createdAt: -1,
      })
      .select(
        "_id inquirer fullName email status createdAt",
      );

  if (!matchingInquiries.length) {
    throw new AppError(
      "This Client is not assigned to the authenticated Agent",
      403,
    );
  }

  /*
   * A Client can have multiple inquiries, so make sure all
   * matching inquiries resolve to the same Luxora User.
   *
   * If the database contains conflicting identities for the
   * same Agent/client email, stop instead of choosing one
   * arbitrarily.
   */
  const uniqueInquirerIds = [
    ...new Set(
      matchingInquiries.map(
        (inquiry) =>
          String(inquiry.inquirer),
      ),
    ),
  ];

  if (uniqueInquirerIds.length > 1) {
    throw new AppError(
      "This Client has conflicting Luxora account identities",
      409,
    );
  }

  const recipientUserId =
    matchingInquiries[0].inquirer;

  // Prevent an Agent from accidentally creating a conversation with themselves.
  if (
    String(recipientUserId) ===
    String(user._id)
  ) {
    throw new AppError(
      "A conversation recipient must be different from the requester",
      400,
    );
  }

  /*
   * Confirm that the resolved Client User is still active.
   *
   * The User ID is used only internally here and is never
   * supplied by the frontend.
   */
  const recipient = await User.findOne({
    _id: recipientUserId,
    isActive: true,
  }).select("_id");

  if (!recipient) {
    throw new AppError(
      "Client messaging account is unavailable",
      404,
    );
  }

  /*
   * Check for an existing Direct conversation first so the
   * controller receives an accurate `created` value without
   * changing the shared direct-conversation engine.
   *
   * This preserves the existing directKey, participant,
   * restore, and duplicate-conversation protections.
   */
  const existing =
    await findDirectConversation(
      user._id,
      recipient._id,
    );

  if (existing) {
    return {
      conversation:
        await restoreDirectConversationForUser(
          existing,
          user._id,
        ),
      created: false,
    };
  }

  const conversation =
    await getOrCreateDirectConversation(
      user._id,
      recipient._id,
    );

  return {
    conversation,
    created: true,
  };
};

/**
 * Creates or retrieves a normal Direct conversation.
 *
 * Every user pair gets one persistent conversation.
 */
const createConversation = async (
  user,
  payload = {},
) => {
  if (
    payload.type ===
    COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY
  ) {
    return createPropertyInquiryConversation(
      user,
      payload.inquiryId,
    );
  }

  if (
    payload.type ===
    COMMUNICATION.CONVERSATION_TYPES.DIRECT
  ) {
    /*
     * Agent → Client messaging does not accept a frontend
     * User ID. When clientEmail is supplied, resolve the
     * recipient from the Agent's own Inquiry records.
     */
    if (payload.clientEmail) {
      return createAgentClientConversation(
        user,
        payload.clientEmail,
      );
    }

    if (
      !mongoose.isValidObjectId(
        payload.targetUserId,
      ) ||
      String(payload.targetUserId) ===
        String(user._id)
    ) {
      throw new AppError(
        "A different valid user is required",
        400,
      );
    }

    const target =
      await User.findById(
        payload.targetUserId,
      ).select("_id isActive");

    if (!target || !target.isActive) {
      throw new AppError(
        "Message recipient is unavailable",
        404,
      );
    }

    const existing =
      await findDirectConversation(
        user._id,
        target._id,
      );

    if (existing) {
      return {
        conversation:
          await restoreDirectConversationForUser(
            existing,
            user._id,
          ),
        created: false,
      };
    }

    const conversation =
      await getOrCreateDirectConversation(
        user._id,
        target._id,
      );

    return {
      conversation,
      created: true,
    };
  }

  throw new AppError(
    "Unsupported conversation type",
    400,
  );
};

const getConversationsForUser = async (
  user,
  query = {},
) => {
  const {
    page,
    limit,
    skip,
  } = getPagination(query);

  const includeArchived =
    query.includeArchived === "true";

  const filter = {
    participants: user._id,
    status:
      COMMUNICATION.CONVERSATION_STATUSES.ACTIVE,
  };

  if (includeArchived) {
    /*
     * When explicitly requesting archived conversations,
     * allow closed conversations as well.
     */
    delete filter.status;
  }

  if (!includeArchived) {
    filter.participantState = {
      $not: {
        $elemMatch: {
          user: user._id,
          archivedAt: {
            $ne: null,
          },
        },
      },
    };
  }

  /*
   * Membership alone is not sufficient for legacy
   * property-inquiry conversations.
   *
   * New Direct conversations rely on participant access.
   */
  const candidateConversations =
    await Conversation.find(filter).sort({
      lastMessageAt: -1,
      updatedAt: -1,
    });

  const accessResults =
    await Promise.all(
      candidateConversations.map(
        async (conversation) => {
          if (
            conversation.type !==
            COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY
          ) {
            return {
              conversation,
              allowed: true,
            };
          }

          try {
            const context =
              await authorizeInquiryCommunication(
                user,
                conversation.inquiry,
              );

            return {
              conversation,
              allowed:
                context.isConversationParticipant,
            };
          } catch {
            return {
              conversation,
              allowed: false,
            };
          }
        },
      ),
    );

  const authorizedConversations =
    accessResults
      .filter(
        (result) => result.allowed,
      )
      .map(
        (result) =>
          result.conversation,
      );

  const total =
    authorizedConversations.length;

  const conversations =
    authorizedConversations.slice(
      skip,
      skip + limit,
    );

  return {
    conversations:
      await Promise.all(
        conversations.map(
          toConversationResponse,
        ),
      ),

    pagination: {
      page,
      limit,
      total,
      totalPages:
        Math.ceil(total / limit),
    },
  };
};

const archiveConversationForUser = async (
  user,
  conversationId,
) => {
  const conversation =
    await getAuthorizedConversation(
      user,
      conversationId,
    );

  const userId = toIdString(user);

  const state =
    conversation.participantState.find(
      (participantState) =>
        toIdString(
          participantState.user,
        ) === userId,
    );

  if (!state) {
    throw new AppError(
      "Conversation participant state is invalid",
      409,
    );
  }

  if (!state.archivedAt) {
    state.archivedAt = new Date();

    await conversation.save();
  }

  return conversation;
};

const unarchiveConversationForUser = async (
  user,
  conversationId,
) => {
  const conversation =
    await getAuthorizedConversation(
      user,
      conversationId,
    );

  const userId = toIdString(user);

  const state =
    conversation.participantState.find(
      (participantState) =>
        toIdString(
          participantState.user,
        ) === userId,
    );

  if (!state) {
    throw new AppError(
      "Conversation participant state is invalid",
      409,
    );
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
  findDirectConversation,
  getAuthorizedConversation,
  getConversationsForUser,
  getOrCreateDirectConversation,
  restoreDirectConversationForUser,
  unarchiveConversationForUser,
  toConversationResponse,
};