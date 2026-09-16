const Procurement = require("../models/procurement.model");
const AppError = require("../utils/AppError");
const auditLogService = require("./audit-log.service");
const { createRecordSchema, updateRecordSchema, recordTypes } = require("../validators/procurement.validator");

const PREFIXES = { vendor: "VND", rfq: "RFQ", request: "PR", order: "PO", contract: "CON", inventory: "INV", asset: "AST", invoice: "PIN", budget: "BUD", payment: "PPY" };
const validType = (recordType) => {
  if (!recordTypes.includes(recordType)) throw new AppError("Unsupported procurement record type", 400);
};
const recordId = (type) => `${PREFIXES[type]}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const serialize = (item) => ({
  id: item.recordId, mongoId: String(item._id), recordType: item.recordType, name: item.name,
  description: item.description, status: item.status, category: item.category, department: item.department,
  amount: item.amount, currency: item.currency, quantity: item.quantity, dueDate: item.dueDate,
  vendorId: item.vendor ? String(item.vendor._id || item.vendor) : null,
  vendorName: item.vendorName || item.vendor?.name || "", relatedRecordId: item.relatedRecord ? String(item.relatedRecord) : null,
  propertyId: item.property ? String(item.property) : null, attachmentUrl: item.attachmentUrl,
  metadata: item.metadata || {}, createdAt: item.createdAt, updatedAt: item.updatedAt,
});

exports.list = async (recordType, filters = {}) => {
  validType(recordType);
  const query = { recordType };
  if (filters.status) query.status = filters.status;
  if (filters.search) query.$or = [{ name: new RegExp(filters.search, "i") }, { recordId: new RegExp(filters.search, "i") }, { vendorName: new RegExp(filters.search, "i") }];
  const records = await Procurement.find(query).populate("vendor", "name recordId").sort({ createdAt: -1 }).lean();
  return records.map(serialize);
};

exports.create = async (recordType, payload, req) => {
  validType(recordType);
  const { value, error } = createRecordSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new AppError(error.details.map((item) => item.message).join(", "), 400);
  if (value.vendorId) {
    const vendor = await Procurement.findOne({ _id: value.vendorId, recordType: "vendor" });
    if (!vendor) throw new AppError("Selected vendor was not found", 404);
    value.vendorName = vendor.name;
  }
  const record = await Procurement.create({
    recordType, recordId: recordId(recordType), ...value,
    vendor: value.vendorId || null, relatedRecord: value.relatedRecordId || null, property: value.propertyId || null,
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  await auditLogService.createAuditLog({ req, action: `procurement.${recordType}.created`, category: "Procurement", description: `Created procurement ${recordType} ${record.recordId}`, targetType: "Procurement", targetId: record._id, targetName: record.name });
  return serialize(record);
};

exports.update = async (recordType, recordIdValue, payload, req) => {
  validType(recordType);
  const { value, error } = updateRecordSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new AppError(error.details.map((item) => item.message).join(", "), 400);
  const record = await Procurement.findOne({ recordType, recordId: recordIdValue });
  if (!record) throw new AppError("Procurement record not found", 404);
  if (value.vendorId) {
    const vendor = await Procurement.findOne({ _id: value.vendorId, recordType: "vendor" });
    if (!vendor) throw new AppError("Selected vendor was not found", 404);
    record.vendor = vendor._id; record.vendorName = vendor.name;
  }
  ["name", "description", "status", "category", "department", "amount", "currency", "quantity", "dueDate", "vendorName", "attachmentUrl", "metadata"].forEach((key) => { if (value[key] !== undefined) record[key] = value[key]; });
  if (value.relatedRecordId !== undefined) record.relatedRecord = value.relatedRecordId || null;
  if (value.propertyId !== undefined) record.property = value.propertyId || null;
  record.updatedBy = req.user._id;
  await record.save();
  await auditLogService.createAuditLog({ req, action: `procurement.${recordType}.updated`, category: "Procurement", description: `Updated procurement ${recordType} ${record.recordId}`, targetType: "Procurement", targetId: record._id, targetName: record.name });
  return serialize(record);
};

exports.getOverview = async () => {
  const [vendors, pendingRequests, openRfqs, orders, invoices, recentActivity, counts] = await Promise.all([
    Procurement.countDocuments({ recordType: "vendor", status: "Active" }),
    Procurement.countDocuments({ recordType: "request", status: "Pending Approval" }),
    Procurement.countDocuments({ recordType: "rfq", status: { $in: ["Open", "Evaluating"] } }),
    Procurement.countDocuments({ recordType: "order", status: { $nin: ["Fulfilled", "Cancelled"] } }),
    Procurement.aggregate([{ $match: { recordType: "invoice", status: { $ne: "Paid" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Procurement.find().sort({ updatedAt: -1 }).limit(6).lean(),
    Procurement.aggregate([{ $group: { _id: "$recordType", count: { $sum: 1 } } }]),
  ]);
  // Return every supported record-type count from the same Procurement
  // collection used by the dashboard. Missing types are explicitly zero so
  // the sidebar never has to fall back to mock badge values.
  const recordCounts = Object.fromEntries(recordTypes.map((type) => [type, 0]));
  counts.forEach((item) => { recordCounts[item._id] = item.count; });
  return { summary: { activeVendors: vendors, pendingRequests, openRfqs, openOrders: orders, unpaidInvoiceAmount: invoices[0]?.total || 0 }, recordCounts, recentActivity: recentActivity.map(serialize) };
};

// This is a live operational report, not a fabricated financial forecast or a
// Finance-owned settlement report. It remains read-only for Procurement.
exports.getReport = async () => {
  const breakdown = await Procurement.aggregate([
    { $group: { _id: "$recordType", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
    { $sort: { _id: 1 } },
  ]);
  return { generatedAt: new Date(), breakdown: breakdown.map((item) => ({ recordType: item._id, count: item.count, totalAmount: item.totalAmount || 0, currency: "NGN" })) };
};

// Return an explicit zero for every tab so the client never has to invent a
// badge value when the corresponding collection currently has no documents.
exports.getCounts = async () => {
  const counts = await Procurement.aggregate([
    { $group: { _id: "$recordType", count: { $sum: 1 } } },
  ]);
  return recordTypes.reduce((result, recordType) => {
    result[recordType] = counts.find((item) => item._id === recordType)?.count || 0;
    return result;
  }, {});
};
