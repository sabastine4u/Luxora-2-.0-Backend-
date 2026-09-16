const service = require("../services/property-management.service");
const api = require("../utils/api-response");
const AppError = require("../utils/AppError");
const validators = require("../validators/property-management.validator");
const Tenant = require("../models/tenant-occupancy.model");
const Lease = require("../models/lease.model");
const WorkOrder = require("../models/maintenance-work-order.model");
const Inspection = require("../models/inspection.model");
const Expense = require("../models/expense.model");
const Income = require("../models/income.model");

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) throw new AppError(error.details.map((detail) => detail.message).join(", "), 400);
  return value;
};
const recordResponse = (key, action) => async (req, res, next) => { try { const record = await action(req); return api.success(res, { [key]: record }, `${key} retrieved successfully`); } catch (error) { return next(error); } };
const listResponse = (key, Model, populate = []) => async (req, res, next) => { try { const query = validate(validators.listQuerySchema, req.query); const result = await service.listRecords(Model, req.user, query, populate); return api.success(res, { [key]: result.records, pagination: { total: result.total, page: result.page, limit: result.limit } }, `${key} retrieved successfully`); } catch (error) { return next(error); } };
const mutation = (schema, key, action, status = 200) => async (req, res, next) => { try { const data = validate(schema, req.body); const record = await action(req, data); const message = `${key} ${status === 201 ? "created" : "updated"} successfully`; return api.success(res, { [key]: record }, message, status); } catch (error) { return next(error); } };

exports.getPortfolioProperties = recordResponse("properties", (req) => service.getPortfolioProperties(req.user));

exports.listTenants = listResponse("tenants", Tenant, ["property", "tenantUser", "lease"]);
exports.getTenant = recordResponse("tenant", (req) => service.getScopedRecord(Tenant, req.params.id, req.user, ["property", "tenantUser", "lease"]));
exports.createTenant = mutation(validators.tenantCreateSchema, "tenant", (req, data) => service.createTenant(data, req.user), 201);
exports.updateTenant = mutation(validators.tenantUpdateSchema, "tenant", (req, data) => service.updateTenant(req.params.id, data, req.user));

exports.listLeases = listResponse("leases", Lease, ["property", "tenant"]);
exports.getLease = recordResponse("lease", (req) => service.getScopedRecord(Lease, req.params.id, req.user, ["property", "tenant"]));
exports.createLease = mutation(validators.leaseCreateSchema, "lease", (req, data) => service.createLease(data, req.user), 201);
exports.updateLease = mutation(validators.leaseUpdateSchema, "lease", (req, data) => service.updateLease(req.params.id, data, req.user));
exports.renewLease = mutation(validators.leaseRenewSchema, "lease", (req, data) => service.renewLease(req.params.id, data, req.user));
exports.terminateLease = mutation(validators.terminateSchema, "lease", (req, data) => service.terminateLease(req.params.id, data.reason, req.user));

exports.listWorkOrders = listResponse("workOrders", WorkOrder, ["property", "tenant", "vendor", "assignedUser"]);
exports.getWorkOrder = recordResponse("workOrder", (req) => service.getScopedRecord(WorkOrder, req.params.id, req.user, ["property", "tenant", "vendor", "assignedUser"]));
exports.createWorkOrder = mutation(validators.workOrderCreateSchema, "workOrder", (req, data) => service.createWorkOrder(data, req.user), 201);
exports.updateWorkOrder = mutation(validators.workOrderUpdateSchema, "workOrder", (req, data) => service.updateWorkOrder(req.params.id, data, req.user));
exports.assignWorkOrder = mutation(validators.workOrderAssignSchema, "workOrder", (req, data) => service.assignWorkOrder(req.params.id, data, req.user));
exports.updateWorkOrderStatus = mutation(validators.workOrderStatusSchema, "workOrder", (req, data) => service.transitionWorkOrder(req.params.id, data.status, req.user));
exports.bulkAssignWorkOrders = async (req, res, next) => { try { const data = validate(validators.bulkAssignSchema, req.body); const workOrders = await service.bulkAssignWorkOrders(data.workOrderIds, data, req.user); return api.success(res, { workOrders }, "Work orders assigned successfully"); } catch (error) { return next(error); } };

exports.listInspections = listResponse("inspections", Inspection, ["property", "tenant", "inspector"]);
exports.getInspection = recordResponse("inspection", (req) => service.getScopedRecord(Inspection, req.params.id, req.user, ["property", "tenant", "inspector"]));
exports.createInspection = mutation(validators.inspectionCreateSchema, "inspection", (req, data) => service.createInspection(data, req.user), 201);
exports.updateInspection = mutation(validators.inspectionUpdateSchema, "inspection", (req, data) => service.updateInspection(req.params.id, data, req.user));
exports.completeInspection = mutation(validators.inspectionCompleteSchema, "inspection", (req, data) => service.completeInspection(req.params.id, data, req.user));

exports.listPayments = async (req, res, next) => { try { const query = validate(validators.listQuerySchema, req.query); const result = await service.getPortfolioPayments(req.user, query); return api.success(res, { payments: result.records, pagination: { total: result.total, page: result.page, limit: result.limit } }, "Portfolio payments retrieved successfully"); } catch (error) { return next(error); } };
exports.getPayment = recordResponse("payment", (req) => service.getPortfolioPayment(req.params.id, req.user));
exports.updatePaymentStatus = mutation(validators.paymentStatusSchema, "payment", (req, data) => service.updatePortfolioPaymentStatus(req.params.id, data.status, req.user));

exports.listExpenses = listResponse("expenses", Expense, ["property", "createdBy", "approvedBy"]);
exports.getExpense = recordResponse("expense", (req) => service.getScopedRecord(Expense, req.params.id, req.user, ["property", "createdBy", "approvedBy"]));
exports.createExpense = mutation(validators.expenseCreateSchema, "expense", (req, data) => service.createExpense(data, req.user), 201);
exports.updateExpense = mutation(validators.expenseUpdateSchema, "expense", (req, data) => service.updateExpense(req.params.id, data, req.user));
exports.approveExpense = async (req, res, next) => { try { const expense = await service.approveExpense(req.params.id, req.user); return api.success(res, { expense }, "Expense approved successfully"); } catch (error) { return next(error); } };

exports.listIncome = listResponse("income", Income, ["property", "createdBy"]);
exports.getIncome = recordResponse("income", (req) => service.getScopedRecord(Income, req.params.id, req.user, ["property", "createdBy"]));
exports.createIncome = mutation(validators.incomeCreateSchema, "income", (req, data) => service.createIncome(data, req.user), 201);
exports.updateIncome = mutation(validators.incomeUpdateSchema, "income", (req, data) => service.updateIncome(req.params.id, data, req.user));

exports.getSummary = recordResponse("summary", (req) => service.getSummary(req.user));
exports.getAnalytics = recordResponse("analytics", (req) => service.getAnalytics(req.user));
exports.getDocuments = recordResponse("documents", (req) => service.getDocuments(req.user));
