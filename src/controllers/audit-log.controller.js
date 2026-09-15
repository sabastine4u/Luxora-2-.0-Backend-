const AuditLog = require("../models/audit-log.model");
const { success } = require("../utils/api-response");

exports.getAdminAuditLogs = async (
  req,
  res,
  next,
) => {
  try {
    const {
      category,
      action,
      actor,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (action) {
      filter.action = action;
    }

    if (actor) {
      filter.actor = actor;
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte =
          new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);

        end.setHours(
          23,
          59,
          59,
          999,
        );

        filter.createdAt.$lte = end;
      }
    }

    const pageNumber = Math.max(
      Number(page) || 1,
      1,
    );

    const pageSize = Math.min(
      Math.max(
        Number(limit) || 25,
        1,
      ),
      100,
    );

    const skip =
      (pageNumber - 1) *
      pageSize;

    const [
      logs,
      total,
    ] = await Promise.all([
      AuditLog.find(filter)
        .populate(
          "actor",
          "fullName email role",
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      AuditLog.countDocuments(
        filter,
      ),
    ]);

    const formattedLogs =
      logs.map((log) => ({
        id:
          log._id,

        action:
          log.action,

        category:
          log.category,

        description:
          log.description,

        actor: {
          id:
            log.actor?._id ||
            log.actor ||
            null,

          name:
            log.actor?.fullName ||
            log.actorName ||
            "Unknown User",

          email:
            log.actor?.email ||
            null,

          role:
            log.actor?.role ||
            log.actorRole ||
            "Unknown",
        },

        target: {
          type:
            log.targetType ||
            null,

          id:
            log.targetId ||
            null,

          name:
            log.targetName ||
            null,
        },

        metadata:
          log.metadata || null,

        ipAddress:
          log.ipAddress ||
          null,

        userAgent:
          log.userAgent ||
          null,

        createdAt:
          log.createdAt,
      }));

    return success(
      res,
      {
        logs:
          formattedLogs,

        pagination: {
          page:
            pageNumber,

          limit:
            pageSize,

          total,

          pages:
            Math.ceil(
              total /
                pageSize,
            ),
        },
      },
      "System audit logs retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};