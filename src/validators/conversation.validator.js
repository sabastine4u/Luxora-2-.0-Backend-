const Joi = require("joi");

const { COMMUNICATION } = require("../config/constants");

/*
 * Direct conversations support two recipient methods:
 *
 * 1. targetUserId
 *    Used by existing messaging flows where the recipient
 *    User ID is already trusted/known by the calling feature.
 *
 * 2. clientEmail
 *    Used specifically by Agent → Client messaging.
 *    The service resolves the actual Client User internally
 *    from the Agent's own Inquiry relationship.
 *
 * Exactly one of these must be supplied.
 */
const directConversationSchema = Joi.object({
  type: Joi.string()
    .valid(
      COMMUNICATION.CONVERSATION_TYPES.DIRECT,
    )
    .required(),

  targetUserId: Joi.string()
    .hex()
    .length(24),

  clientEmail: Joi.string()
    .email()
    .max(254),
})
  .xor(
    "targetUserId",
    "clientEmail",
  )
  .unknown(false);


/*
 * Property-inquiry conversations continue using
 * the existing inquiry-based conversation flow.
 */
const propertyInquiryConversationSchema = Joi.object({
  type: Joi.string()
    .valid(
      COMMUNICATION.CONVERSATION_TYPES.PROPERTY_INQUIRY,
    )
    .required(),

  inquiryId: Joi.string()
    .hex()
    .length(24)
    .required(),
})
  .unknown(false);


/*
 * The request must match exactly one supported
 * conversation type.
 */
const createConversationSchema = Joi.alternatives()
  .try(
    directConversationSchema,
    propertyInquiryConversationSchema,
  )
  .match("one")
  .required();


module.exports = {
  createConversationSchema,
};