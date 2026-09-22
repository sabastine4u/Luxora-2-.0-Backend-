const messageService = require("../services/message.service");
const api = require("../utils/api-response");
const AppError = require("../utils/AppError");
const { sendMessageSchema } = require("../validators/message.validator");

exports.listMessages = async (req, res, next) => {
  try {
    const result = await messageService.getMessagesForConversation(
      req.user,
      req.params.conversationId,
      req.query,
    );

    return api.success(res, result, "Messages retrieved successfully");
  } catch (error) {
    return next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: false,
    });

    if (error) {
      throw new AppError(
        error.details.map((detail) => detail.message).join(", "),
        400,
      );
    }

    const result = await messageService.sendMessage(
      req.user,
      req.params.conversationId,
      value,
    );

    return api.created(res, result, "Message sent successfully");
  } catch (error) {
    return next(error);
  }
};

exports.markConversationRead = async (req, res, next) => {
  try {
    const conversation = await messageService.markConversationRead(
      req.user,
      req.params.conversationId,
    );

    return api.success(res, { conversation }, "Conversation marked as read");
  } catch (error) {
    return next(error);
  }
};
