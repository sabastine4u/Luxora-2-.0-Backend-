const mongoose = require("mongoose");
const Inquiry = require("../models/inquiry.model");
const Agent = require("../models/agent.model");
const Agency = require("../models/agency.model");
const AppError = require("../utils/AppError");

const toIdString = (value) => {
  if (!value) return null;
  const id = value._id || value;
  return id ? String(id) : null;
};

const uniqueIds = (values) => [
  ...new Set(values.map(toIdString).filter(Boolean)),
];

const isSameId = (left, right) => {
  const leftId = toIdString(left);
  const rightId = toIdString(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

const requireValidObjectId = (value, label) => {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new AppError(`A valid ${label} is required`, 400);
  }
};

/**
 * Resolves the User identities behind an Inquiry's existing business context.
 * No participant IDs are accepted from callers: Property/Inquiry relationships
 * remain the source of truth.
 */
const resolveInquiryContext = async (inquiryId) => {
  requireValidObjectId(inquiryId, "inquiry ID");

  const inquiry = await Inquiry.findById(inquiryId).select(
    "property agency agent owner inquirer fullName email status source",
  );

  if (!inquiry) {
    throw new AppError("Inquiry not found", 404);
  }

  const [agent, agency] = await Promise.all([
    inquiry.agent
      ? Agent.findById(inquiry.agent).select("user agency status")
      : null,
    inquiry.agency
      ? Agency.findById(inquiry.agency).select("user status")
      : null,
  ]);

  // An Inquiry may legitimately be created before a Property has an Agent or
  // Agency.  Return the resolved context without inventing an account link.
  const agentUserId = agent?.user || null;
  const agencyUserId = agency?.user || null;
  const ownerUserId = inquiry.owner || null;
  const inquirerUserId = inquiry.inquirer || null;

  return {
    inquiry,
    propertyId: inquiry.property,
    agentId: inquiry.agent || null,
    agencyId: inquiry.agency || null,
    agentUserId,
    agencyUserId,
    ownerUserId,
    inquirerUserId,
    // The first vertical slice deliberately excludes the Owner from automatic
    // chat participation.  The Owner remains business context and can receive
    // future workflow-specific access only through an explicit policy.
    conversationParticipantUserIds: uniqueIds([
      inquirerUserId,
      agentUserId,
      agencyUserId,
    ]),
    notificationRecipientUserIds: uniqueIds([
      agentUserId,
      agencyUserId,
    ]),
  };
};

const requireAuthenticatedActiveUser = (user) => {
  if (!user?._id) {
    throw new AppError("Authentication required", 401);
  }

  if (!user.isActive) {
    throw new AppError("This account is inactive. Please contact support.", 403);
  }
};

module.exports = {
  isSameId,
  requireAuthenticatedActiveUser,
  resolveInquiryContext,
  toIdString,
  uniqueIds,
};
