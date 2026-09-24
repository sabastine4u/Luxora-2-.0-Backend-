const conversationService = require("../services/conversation.service");
const api = require("../utils/api-response");
const { createConversationSchema } = require("../validators/conversation.validator");
const AppError = require("../utils/AppError");

exports.listConversations = async (req, res, next) => {
  try {
    const result = await conversationService.getConversationsForUser(
      req.user,
      req.query,
    );

    return api.success(res, result, "Conversations retrieved successfully");
  } catch (error) {
    return next(error);
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.getAuthorizedConversation(
      req.user,
      req.params.conversationId,
    );

    return api.success(res, { conversation: await conversationService.toConversationResponse(conversation) }, "Conversation retrieved successfully");
  } catch (error) {
    return next(error);
  }
};

exports.createConversation = async (req, res, next) => {
  try {
    const { error, value } = createConversationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: false,
    });

    if (error) {
      throw new AppError(
        error.details.map((detail) => detail.message).join(", "),
        400,
      );
    }

    const { conversation, created } = await conversationService.createConversation(
      req.user,
      value,
    );

    return api.success(
      res,
      { conversation: await conversationService.toConversationResponse(conversation), created },
      created ? "Conversation created successfully" : "Conversation retrieved successfully",
      created ? 201 : 200,
    );
  } catch (error) {
    return next(error);
  }
};

exports.archiveConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.archiveConversationForUser(
      req.user,
      req.params.conversationId,
    );

    return api.success(res, { conversation: await conversationService.toConversationResponse(conversation) }, "Conversation archived successfully");
  } catch (error) {
    return next(error);
  }
};

exports.unarchiveConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.unarchiveConversationForUser(
      req.user,
      req.params.conversationId,
    );

    return api.success(res, { conversation: await conversationService.toConversationResponse(conversation) }, "Conversation restored successfully");
  } catch (error) {
    return next(error);
  }
};
