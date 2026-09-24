const mongoose = require("mongoose");
const Inquiry = require("../models/inquiry.model");
const Agent = require("../models/agent.model");
const Agency = require("../models/agency.model");
const User = require("../models/user.model");
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
  // References can outlive a disabled or deleted account. Only a real active
  // User account can be made a chat participant.
  const candidateUserIds = uniqueIds([
    agent?.user,
    agency?.user,
    inquiry.owner,
    inquiry.inquirer,
  ]);
  const activeUsers = await User.find({
    _id: { $in: candidateUserIds },
    isActive: true,
  }).select("_id").lean();
  const activeUserIds = new Set(activeUsers.map((user) => String(user._id)));
  const activeUserId = (value) => {
    const id = toIdString(value);
    return id && activeUserIds.has(id) ? id : null;
  };

  const agentUserId = activeUserId(agent?.user);
  const agencyUserId = activeUserId(agency?.user);
  const ownerUserId = activeUserId(inquiry.owner);
  const inquirerUserId = activeUserId(inquiry.inquirer);

  return {
    inquiry,
    propertyId: inquiry.property,
    agentId: inquiry.agent || null,
    agencyId: inquiry.agency || null,
    agentUserId,
    agencyUserId,
    ownerUserId,
    inquirerUserId,
    conversationParticipantUserIds: uniqueIds([
      inquirerUserId,
      ownerUserId,
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
