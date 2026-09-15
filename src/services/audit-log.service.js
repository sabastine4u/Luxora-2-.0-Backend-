const AuditLog = require("../models/audit-log.model");

exports.createAuditLog = async ({
  req,
  action,
  category,
  description,
  targetType = null,
  targetId = null,
  targetName = null,
  metadata = null,
}) => {
  if (!req?.user) {
    throw new Error(
      "Audit log requires an authenticated user",
    );
  }

  return AuditLog.create({
    actor: req.user._id,
    actorName: req.user.fullName,
    actorRole: req.user.role,

    action,
    category,
    description,

    targetType,
    targetId,
    targetName,

    metadata,

    ipAddress:
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null,

    userAgent:
      req.headers["user-agent"] ||
      null,
  });
};