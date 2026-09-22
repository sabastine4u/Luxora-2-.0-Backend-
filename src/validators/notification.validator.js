const Joi = require("joi");
const { NOTIFICATION } = require("../config/constants");

const objectId = Joi.string().hex().length(24);

const createNotificationSchema = Joi.object({
  recipient: objectId.required(),
  actor: objectId.allow(null).default(null),
  type: Joi.string().valid(...NOTIFICATION.TYPES).required(),
  category: Joi.string().valid(...NOTIFICATION.CATEGORIES).required(),
  priority: Joi.string().valid(...NOTIFICATION.PRIORITIES).default("normal"),
  title: Joi.string().trim().min(1).max(200).required(),
  body: Joi.string().trim().min(1).max(2000).required(),
  resourceType: Joi.string()
    .valid(...NOTIFICATION.RESOURCE_TYPES)
    .allow(null)
    .default(null),
  resourceId: objectId.allow(null).default(null),
  property: objectId.allow(null).default(null),
  inquiry: objectId.allow(null).default(null),
  booking: objectId.allow(null).default(null),
  offer: objectId.allow(null).default(null),
  conversation: objectId.allow(null).default(null),
  message: objectId.allow(null).default(null),
  dedupeKey: Joi.string().trim().min(1).max(255).allow(null).default(null),
}).unknown(false).custom((value, helpers) => {
  const hasResourceType = Boolean(value.resourceType);
  const hasResourceId = Boolean(value.resourceId);

  if (hasResourceType !== hasResourceId) {
    return helpers.error("any.invalid");
  }

  if (
    hasResourceType &&
    value[value.resourceType] &&
    value[value.resourceType] !== value.resourceId
  ) {
    return helpers.error("any.invalid");
  }

  return value;
}, "resource reference consistency").messages({
  "any.invalid": "Notification resourceType and resourceId must be provided together and match its resource reference",
});

module.exports = {
  createNotificationSchema,
};
