const User = require("../models/user.model");
const Property = require("../models/property.model");
const Agency = require("../models/agency.model");
const Agent = require("../models/agent.model");
const Payment = require("../models/payment.model");
const Commission = require("../models/commission.model");
const MortgageApplication = require("../models/mortgage-application.model");
const Complaint = require("../models/complaint.model");
const Verification = require("../models/verification.model");
const Procurement = require("../models/procurement.model");
const Service = require("../models/service.model");
const AuditLog = require("../models/audit-log.model");
const { ROLES } = require("../config/constants");

const countByStatus = (Model, filter = {}) => Model.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]);

exports.getOverview = async () => {
  const [totalProperties, publishedProperties, activeUsers, activeAgencies, activeAgents, admins, internalStaff, paidPayments, commissions, mortgagePipeline, complaints, pendingVerifications, procurement, serviceTransactions, auditEvents] = await Promise.all([
    Property.countDocuments(), Property.countDocuments({ status: "Published" }), User.countDocuments({ isActive: true }), Agency.countDocuments({ status: "Active" }), Agent.countDocuments({ status: "Active" }),
    User.countDocuments({ role: ROLES.ADMIN }),
    User.countDocuments({ role: { $in: [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.PROCUREMENT, ROLES.ANALYST, ROLES.PROPERTY_MANAGER, ROLES.SERVICE_ADMIN] }, isActive: true }),
    Payment.aggregate([{ $match: { status: "Paid" } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
    countByStatus(Commission), countByStatus(MortgageApplication), Complaint.countDocuments({ status: { $in: ["Open", "In Progress", "Escalated"] } }), Verification.countDocuments({ status: "Pending" }),
    Procurement.countDocuments(), Service.countDocuments({ recordType: "transaction" }), AuditLog.countDocuments(),
  ]);
  return {
    platform: { totalProperties, publishedProperties, activeUsers, activeAgencies, activeAgents, admins },
    finance: { paidPayments: paidPayments[0] || { count: 0, amount: 0 }, commissionLifecycle: commissions, mortgagePipeline },
    workforce: { activeInternalStaff: internalStaff },
    operations: { procurementRecords: procurement, homeServiceTransactions: serviceTransactions },
    oversight: { openComplaints: complaints, pendingVerifications, auditEvents },
    scopes: { platform: "global platform counts", finance: "paid payments are actual recorded payments; commission and mortgage values are lifecycle counts", workforce: "active internal User accounts", operations: "global operational record counts", oversight: "global open/pending records" },
  };
};

exports.getCounts = async () => {
  const overview = await exports.getOverview();
  return { properties: overview.platform.totalProperties, users: overview.platform.activeUsers, admins: overview.platform.admins, agencies: overview.platform.activeAgencies, agents: overview.platform.activeAgents, complaints: overview.oversight.openComplaints, verifications: overview.oversight.pendingVerifications, procurement: overview.operations.procurementRecords, serviceTransactions: overview.operations.homeServiceTransactions };
};
