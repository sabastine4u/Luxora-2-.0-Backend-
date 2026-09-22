const AppError = require("../utils/AppError");
const {
  isSameId,
  requireAuthenticatedActiveUser,
  resolveInquiryContext,
  toIdString,
} = require("./communication-context.service");

/**
 * Checks access to an Inquiry-derived communication context.  This is the
 * shared policy seam for the first property-inquiry communication slice; it
 * intentionally does not grant blanket administrative or role-based access.
 */
const authorizeInquiryCommunication = async (user, inquiryId) => {
  requireAuthenticatedActiveUser(user);

  const context = await resolveInquiryContext(inquiryId);
  const userId = toIdString(user);

  const isParticipant = context.conversationParticipantUserIds.includes(userId);
  const isOwnerInContext = isSameId(context.ownerUserId, user);

  // Owners are allowed to access an inquiry's business context for their own
  // listing, but are not automatically added to the first-release chat.
  if (!isParticipant && !isOwnerInContext) {
    throw new AppError(
      "You do not have permission to access communication for this inquiry",
      403,
    );
  }

  return {
    ...context,
    userId,
    isConversationParticipant: isParticipant,
    isOwnerInContext,
  };
};

/**
 * The Contact Agent workflow can create an authenticated conversation only
 * when the Inquiry belongs to the authenticated requester and there is at
 * least one accountable Agent or Agency account to receive it.
 */
const authorizeAuthenticatedInquiryConversationCreation = async (
  user,
  inquiryId,
) => {
  const context = await authorizeInquiryCommunication(user, inquiryId);

  if (!isSameId(context.inquirerUserId, user)) {
    throw new AppError(
      "Only the authenticated inquirer can start this inquiry conversation",
      403,
    );
  }

  if (context.notificationRecipientUserIds.length === 0) {
    throw new AppError(
      "This inquiry has no assigned Agent or Agency communication recipient",
      409,
    );
  }

  return context;
};

/**
 * Future Conversation/Message services call this after loading a conversation
 * and its participant list.  It prevents guessed conversation IDs from being
 * useful without embedding any database-model assumption in the middleware.
 */
const assertConversationParticipant = (user, participantIds = []) => {
  requireAuthenticatedActiveUser(user);

  const userId = toIdString(user);
  const isParticipant = participantIds.some((participantId) =>
    isSameId(participantId, userId),
  );

  if (!isParticipant) {
    throw new AppError(
      "You do not have permission to access this conversation",
      403,
    );
  }
};

module.exports = {
  assertConversationParticipant,
  authorizeAuthenticatedInquiryConversationCreation,
  authorizeInquiryCommunication,
};
