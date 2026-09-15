const Complaint = require("../models/complaint.model");

const api = require("../utils/api-response");

exports.getAdminComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find()
      .populate({
        path: "reporter",
        select: "fullName email role",
      })
      .populate({
        path: "assignedTo",
        select: "fullName email role",
      })
      .sort({
        createdAt: -1,
      })
      .lean();

    const formattedComplaints =
      complaints.map((complaint) => ({
        id: complaint._id,
        ticketId: complaint.ticketId,

        type: complaint.type,

        user:
          complaint.reporter?.fullName ||
          complaint.reporterName ||
          "Anonymous",

        target: complaint.targetName,

        targetType:
          complaint.targetType,

        status: complaint.status,

        priority: complaint.priority,

        description:
          complaint.description,

        assignedTo:
          complaint.assignedTo
            ? {
                id: complaint.assignedTo._id,
                name:
                  complaint.assignedTo
                    .fullName,
                email:
                  complaint.assignedTo
                    .email,
                role:
                  complaint.assignedTo
                    .role,
              }
            : null,

        resolutionSummary:
          complaint.resolutionSummary,

        internalNotes:
          complaint.internalNotes,

        createdAt:
          complaint.createdAt,

        updatedAt:
          complaint.updatedAt,

        resolvedAt:
          complaint.resolvedAt,

        closedAt:
          complaint.closedAt,

        escalatedAt:
          complaint.escalatedAt,
      }));

    return api.success(
      res,
      {
        complaints:
          formattedComplaints,
      },
      "Admin complaints retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createComplaint = async (req, res, next) => {
  try {
    const {
      type,
      description,
      reporterName,
      targetType,
      targetId,
      targetName,
      priority,
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Complaint type is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Complaint description is required",
      });
    }

    if (!targetType) {
      return res.status(400).json({
        success: false,
        message: "Complaint target type is required",
      });
    }

    if (!targetName) {
      return res.status(400).json({
        success: false,
        message: "Complaint target is required",
      });
    }

    const complaint = await Complaint.create({
      ticketId: `TKT-${Date.now()}`,

      type,

      description,

      reporter: req.user?._id || null,

      reporterName:
        reporterName ||
        req.user?.fullName ||
        "Anonymous",

      targetType,

      targetId: targetId || null,

      targetName,

      priority:
        priority || "Medium",

      status: "Open",

      assignedTo: null,

      resolutionSummary: "",

      internalNotes: "",

    });

    return api.success(
      res,
      {
        complaint,
      },
      "Complaint submitted successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.updateComplaintStatus = async (
  req,
  res,
  next,
) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "In Progress",
      "Escalated",
      "Resolved",
      "Closed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint status",
      });
    }

    const complaint =
      await Complaint.findById(
        req.params.id,
      );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    complaint.status = status;

    /*
     * Record the moderator handling
     * the complaint.
     */
    if (status === "In Progress") {
      complaint.assignedTo =
        req.user._id;
    }

    if (status === "Escalated") {
      complaint.assignedTo =
        req.user._id;

      complaint.escalatedAt =
        new Date();
    }

    if (status === "Resolved") {
      complaint.assignedTo =
        req.user._id;

      complaint.resolvedAt =
        new Date();
    }

    if (status === "Closed") {
      complaint.assignedTo =
        req.user._id;

      complaint.closedAt =
        new Date();
    }

    await complaint.save();

    return api.success(
      res,
      {
        complaint,
      },
      "Complaint status updated successfully",
    );
  } catch (error) {
    next(error);
  }
};