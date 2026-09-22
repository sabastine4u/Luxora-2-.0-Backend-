const Joi = require("joi");

const sendMessageSchema = Joi.object({
  type: Joi.string().valid("text").default("text"),
  body: Joi.string().trim().min(1).max(2000).required(),
}).unknown(false);

module.exports = {
  sendMessageSchema,
};
