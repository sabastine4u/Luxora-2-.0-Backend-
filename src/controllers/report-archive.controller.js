const ReportArchive = require("../models/report-archive.model");

const REPORT_NAMES = {
  financial: "Financial Report",
  "user-growth": "User Growth Report",
  "listing-performance": "Listing Performance Report",
  "system-audit": "System Audit Logs",
};

const ALLOWED_CATEGORIES = Object.keys(REPORT_NAMES);

exports.createReportArchive = async (req, res, next) => {
  try {
    const {
      category,
      startDate = null,
      endDate = null,
      metrics,
      format = "snapshot",
      fileSize = null,
    } = req.body;

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "A valid report category is required.",
      });
    }

    if (!metrics || typeof metrics !== "object") {
      return res.status(400).json({
        success: false,
        message: "Report metrics are required.",
      });
    }

    const report = await ReportArchive.create({
      name: REPORT_NAMES[category],
      category,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      metrics,
      format,
      fileSize,
      generatedBy: req.user._id,
      generatedByName: req.user.fullName,
      generatedByRole: req.user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Report archived successfully",
      report: {
        id: report._id,
        name: report.name,
        category: report.category,
        startDate: report.startDate,
        endDate: report.endDate,
        metrics: report.metrics,
        format: report.format,
        fileSize: report.fileSize,
        generatedBy: {
          id: req.user._id,
          name: req.user.fullName,
          role: req.user.role,
        },
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getArchivedReports = async (req, res, next) => {
  try {
    const {
      category,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {};

    if (category) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report category.",
        });
      }

      filter.category = category;
    }

    const total = await ReportArchive.countDocuments(filter);

    const reports = await ReportArchive.find(filter)
      .populate("generatedBy", "fullName email role")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageLimit)
      .limit(pageLimit)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Archived reports retrieved successfully",
      reports: reports.map((report) => ({
        id: report._id,
        name: report.name,
        category: report.category,
        startDate: report.startDate,
        endDate: report.endDate,
        metrics: report.metrics,
        format: report.format,
        fileSize: report.fileSize,
        generatedBy: report.generatedBy
          ? {
              id: report.generatedBy._id,
              name: report.generatedBy.fullName,
              email: report.generatedBy.email,
              role: report.generatedBy.role,
            }
          : {
              id: report.generatedBy,
              name: report.generatedByName,
              role: report.generatedByRole,
            },
        createdAt: report.createdAt,
      })),
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getArchivedReportById = async (req, res, next) => {
  try {
    const report = await ReportArchive.findById(req.params.id)
      .populate("generatedBy", "fullName email role")
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Archived report not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Archived report retrieved successfully",
      report: {
        id: report._id,
        name: report.name,
        category: report.category,
        startDate: report.startDate,
        endDate: report.endDate,
        metrics: report.metrics,
        format: report.format,
        fileSize: report.fileSize,
        generatedBy: report.generatedBy
          ? {
              id: report.generatedBy._id,
              name: report.generatedBy.fullName,
              email: report.generatedBy.email,
              role: report.generatedBy.role,
            }
          : {
              id: report.generatedBy,
              name: report.generatedByName,
              role: report.generatedByRole,
            },
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};