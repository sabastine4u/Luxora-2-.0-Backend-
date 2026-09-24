const Joi = require("joi");
const { COMMUNICATION } = require("../config/constants");

// Contextual participant, Property, and owner fields are deliberately absent.
// The service resolves them only from the authoritative Inquiry relationship.
const createConversationSchema = Joi.object({
  type: Joi.string()
    .valid(COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY, COMMUNICATION.CONVERSATION_TYPES.DIRECT)
    .required(),
  inquiryId: Joi.when('type', { is: COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY, then: Joi.string().hex().length(24).required() }),
  targetUserId: Joi.when('type', { is: COMMUNICATION.CONVERSATION_TYPES.DIRECT, then: Joi.string().hex().length(24).required() }),
}).unknown(false);

module.exports = {
  createConversationSchema,
};
