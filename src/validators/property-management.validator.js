const Joi = require("joi");

const objectId = Joi.string().hex().length(24);
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
};
const dateRange = {
  from: Joi.date().iso().allow(null, ""),
  to: Joi.date().iso().allow(null, ""),
};

const tenantCreateSchema = Joi.object({
  propertyId: objectId.required(), tenantUserId: objectId.allow(null, ""),
  fullName: Joi.string().trim().max(200).required(), email: Joi.string().email().allow(null, ""),
  phone: Joi.string().trim().max(50).allow(null, ""), unit: Joi.string().trim().max(100).allow(null, ""),
  status: Joi.string().valid("Active", "Moving Out", "Eviction", "Past"),
  moveInDate: Joi.date().iso().allow(null), moveOutDate: Joi.date().iso().allow(null),
});
const tenantUpdateSchema = tenantCreateSchema.fork(["propertyId", "fullName"], (field) => field.optional()).min(1);
const leaseCreateSchema = Joi.object({
  propertyId: objectId.required(), tenantId: objectId.required(), unit: Joi.string().trim().max(100).allow(null, ""),
  startDate: Joi.date().iso().required(), endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
  monthlyRent: Joi.number().min(0).required(), deposit: Joi.number().min(0).default(0),
});
const leaseUpdateSchema = Joi.object({ unit: Joi.string().trim().max(100).allow(null, ""), endDate: Joi.date().iso(), monthlyRent: Joi.number().min(0), deposit: Joi.number().min(0) }).min(1);
const leaseRenewSchema = Joi.object({ startDate: Joi.date().iso().required(), endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(), monthlyRent: Joi.number().min(0), deposit: Joi.number().min(0) });
const terminateSchema = Joi.object({ reason: Joi.string().trim().max(2000).required() });
const workOrderCreateSchema = Joi.object({ propertyId: objectId.required(), tenantId: objectId.allow(null, ""), unit: Joi.string().trim().max(100).allow(null, ""), title: Joi.string().trim().max(200).required(), description: Joi.string().trim().max(5000).allow("", null), priority: Joi.string().valid("Low", "Medium", "High", "Emergency").default("Low"), estimatedCost: Joi.number().min(0).allow(null), actualCost: Joi.number().min(0).allow(null) });
const workOrderUpdateSchema = Joi.object({ tenantId: objectId.allow(null, ""), unit: Joi.string().trim().max(100).allow(null, ""), title: Joi.string().trim().max(200), description: Joi.string().trim().max(5000).allow("", null), priority: Joi.string().valid("Low", "Medium", "High", "Emergency"), estimatedCost: Joi.number().min(0).allow(null), actualCost: Joi.number().min(0).allow(null) }).min(1);
const workOrderAssignSchema = Joi.object({ vendorId: objectId.allow(null, ""), assignedUserId: objectId.allow(null, "") }).or("vendorId", "assignedUserId");
const workOrderStatusSchema = Joi.object({ status: Joi.string().valid("Open", "Assigned", "In Progress", "Resolved", "Closed", "Cancelled").required() });
const bulkAssignSchema = Joi.object({ workOrderIds: Joi.array().items(objectId).min(1).max(100).required(), vendorId: objectId.allow(null, ""), assignedUserId: objectId.allow(null, "") }).or("vendorId", "assignedUserId");
const inspectionCreateSchema = Joi.object({ propertyId: objectId.required(), tenantId: objectId.allow(null, ""), unit: Joi.string().trim().max(100).allow(null, ""), scheduledAt: Joi.date().iso().required(), inspectorId: objectId.allow(null, ""), inspectorName: Joi.string().trim().max(200).allow(null, ""), type: Joi.string().valid("Move-in", "Move-out", "Routine", "Emergency").required() });
const inspectionUpdateSchema = Joi.object({ scheduledAt: Joi.date().iso(), inspectorId: objectId.allow(null, ""), inspectorName: Joi.string().trim().max(200).allow(null, ""), type: Joi.string().valid("Move-in", "Move-out", "Routine", "Emergency"), status: Joi.string().valid("Cancelled") }).min(1);
const inspectionCompleteSchema = Joi.object({ score: Joi.number().min(0).max(100).allow(null), findings: Joi.array().items(Joi.string().trim().max(2000)).max(100).default([]), reportUrl: Joi.string().uri().allow(null, "") });
const paymentStatusSchema = Joi.object({ status: Joi.string().valid("Pending", "Paid", "Overdue", "Failed").required() });
const expenseCreateSchema = Joi.object({ propertyId: objectId.required(), category: Joi.string().valid("Maintenance", "Taxes", "Insurance", "Utilities", "Management Fee", "Other").required(), amount: Joi.number().min(0).required(), expenseDate: Joi.date().iso().required(), description: Joi.string().trim().max(2000).allow("", null), vendorName: Joi.string().trim().max(200).allow(null, ""), receiptUrl: Joi.string().uri().allow(null, "") });
const expenseUpdateSchema = expenseCreateSchema.fork(["propertyId", "category", "amount", "expenseDate"], (field) => field.optional()).min(1);
const incomeCreateSchema = Joi.object({ propertyId: objectId.required(), category: Joi.string().valid("Late Fee", "Security Deposit", "Other").required(), amount: Joi.number().min(0).required(), incomeDate: Joi.date().iso().required(), description: Joi.string().trim().max(2000).allow("", null) });
const incomeUpdateSchema = incomeCreateSchema.fork(["propertyId", "category", "amount", "incomeDate"], (field) => field.optional()).min(1);
const listQuerySchema = Joi.object({ ...pagination, ...dateRange, propertyId: objectId, tenantId: objectId, status: Joi.string().max(50), search: Joi.string().trim().max(200), category: Joi.string().max(100) });

module.exports = { tenantCreateSchema, tenantUpdateSchema, leaseCreateSchema, leaseUpdateSchema, leaseRenewSchema, terminateSchema, workOrderCreateSchema, workOrderUpdateSchema, workOrderAssignSchema, workOrderStatusSchema, bulkAssignSchema, inspectionCreateSchema, inspectionUpdateSchema, inspectionCompleteSchema, paymentStatusSchema, expenseCreateSchema, expenseUpdateSchema, incomeCreateSchema, incomeUpdateSchema, listQuerySchema };
