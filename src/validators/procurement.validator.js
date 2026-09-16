const Joi = require("joi");

const recordTypes = ["vendor", "rfq", "request", "order", "contract", "inventory", "asset", "invoice", "budget", "payment"];

const createRecordSchema = Joi.object({
  name: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().max(4000).allow("", null),
  status: Joi.string().trim().max(80),
  category: Joi.string().trim().max(120).allow("", null),
  department: Joi.string().trim().max(120).allow("", null),
  amount: Joi.number().min(0),
  currency: Joi.string().trim().length(3),
  quantity: Joi.number().min(0).allow(null),
  dueDate: Joi.date().allow(null),
  vendorId: Joi.string().hex().length(24).allow(null, ""),
  vendorName: Joi.string().trim().max(200).allow("", null),
  relatedRecordId: Joi.string().hex().length(24).allow(null, ""),
  propertyId: Joi.string().hex().length(24).allow(null, ""),
  attachmentUrl: Joi.string().uri().allow(null, ""),
  metadata: Joi.object().default({}),
});

const updateRecordSchema = createRecordSchema.fork(["name"], (field) => field.optional()).min(1);

module.exports = { recordTypes, createRecordSchema, updateRecordSchema };
