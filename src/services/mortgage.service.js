// Import the Mortgage Application model so we can create and retrieve applications.
const MortgageApplication = require("../models/mortgage-application.model");

const auditLogService = require("./audit-log.service");

// Import the Property model so we can verify the property being financed.
const Property = require("../models/property.model");

// Import AppError so predictable business-rule failures use the centralized error handler.
const AppError = require("../utils/AppError");

// Create the initial timeline used for a newly submitted mortgage application.
const buildInitialStages = (buyerId) => {
  // Record the first application stage when the Buyer submits the application.
  return [
    {
  label: "Application Submitted",
  date: new Date(),
  completed: true,
  completedBy: buyerId,
},

    {
      label: "Document Verification",
      date: null,
      completed: false,
    },
    {
      label: "Credit Assessment",
      date: null,
      completed: false,
    },
    {
      label: "Approval & Offer",
      date: null,
      completed: false,
    },
    {
      label: "Disbursement",
      date: null,
      completed: false,
    },
  ];
};

const completeStage = (
  stages,
  label,
  userId,
  completedAt = new Date(),
) => {
  const stage = stages.find(
    (item) => item.label === label,
  );

  if (!stage) {
    throw new AppError(
      `Mortgage stage "${label}" was not found.`,
      500,
    );
  }

  stage.date = completedAt;
  stage.completed = true;
  stage.completedBy = userId;
};

// Create a Mortgage Application for the authenticated Buyer.
const createMortgageApplication = async (buyerId, applicationData) => {
  // Find the Property the Buyer wants to finance.
  const property = await Property.findById(applicationData.propertyId);

  // Stop the request when the Property does not exist.
  if (!property) {
    throw new AppError("Property not found.", 404);
  }

  // Mortgage applications are only available for properties listed for purchase.
  if (property.transactionType !== "buy") {
    throw new AppError(
      "Mortgage applications can only be submitted for properties listed for sale.",
      400,
    );
  }

  // Only published and available properties can be financed through a new application.
  if (
    property.status !== "Published" ||
    property.availabilityStatus !== "Available"
  ) {
    throw new AppError(
      "This property is not currently available for mortgage financing.",
      400,
    );
  }

  // Prevent the same Buyer from creating multiple active applications for the same Property.
  const existingApplication = await MortgageApplication.findOne({
    buyer: buyerId,
    property: property._id,
    status: {
      $in: [
        "Submitted",
        "Document Verification",
        "Credit Assessment",
        "Approved",
      ],
    },
  });

  // Stop the request when an active application already exists.
  if (existingApplication) {
    throw new AppError(
      "You already have an active mortgage application for this property.",
      400,
    );
  }

  // Create the Mortgage Application using server-controlled Buyer and Property relationships.
  const application = await MortgageApplication.create({
    buyer: buyerId,
    property: property._id,
    lender: applicationData.lender || "",
    requestedLoanAmount: applicationData.requestedLoanAmount,
    interestRate: applicationData.interestRate ?? null,
    loanTermYears: applicationData.loanTermYears ?? null,
    status: "Submitted",
   stages: buildInitialStages(buyerId),
  });

  // Return the new application with its related Property populated.
  return MortgageApplication.findById(application._id).populate("property");
};

// Retrieve all Mortgage Applications belonging to the authenticated Buyer.
const getMortgageApplicationsByBuyer = async (buyerId) => {
  // Retrieve only applications created by this Buyer.
  return MortgageApplication.find({
    buyer: buyerId,
  })
    // Include the related Property details for the Buyer Dashboard.
    .populate("property")
    // Show the newest applications first.
    .sort({ createdAt: -1 });
};

const getMortgageApplicationsForOperations = async (
  query = {},
) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || 25, 1),
    100,
  );

  const filter = {};

  if (query.status && query.status !== "all") {
    const allowedStatuses = [
      "Submitted",
      "Document Verification",
      "Credit Assessment",
      "Approved",
      "Rejected",
      "Disbursed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(query.status)) {
      throw new AppError(
        "Invalid mortgage application status filter.",
        400,
      );
    }

    filter.status = query.status;
  } else if (query.status !== "all") {
    filter.status = {
      $in: [
        "Submitted",
        "Document Verification",
        "Credit Assessment",
        "Approved",
      ],
    };
  }

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    MortgageApplication.find(filter)
      .populate(
        "buyer",
        "fullName email phone role",
      )
      .populate(
        "property",
        "title price transactionType status availabilityStatus",
      )
      .populate(
        "stages.completedBy",
        "fullName role",
      )
      .populate(
        "rejectedBy",
        "fullName role",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    MortgageApplication.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const processMortgageApplication = async (
  mortgageId,
  workflowData,
  req,
) => {
  const application =
  await MortgageApplication.findById(
    mortgageId,
  )
    .populate(
      "buyer",
      "fullName email",
    )
    .populate(
      "property",
      "title price transactionType status availabilityStatus",
    );

  if (!application) {
    throw new AppError(
      "Mortgage application not found.",
      404,
    );
  }

  const actorId = req.user._id;
  const now = new Date();
  const previousStatus = application.status;

  const buyerName =
  application.buyer?.fullName ||
  application.buyer?.email ||
  "the buyer";

const propertyName =
  application.property?.title ||
  "the selected property";

const auditSubject =
  `${buyerName} — ${propertyName}`;

  let actionName = "";
  let description = "";

  switch (workflowData.action) {
    case "start_verification": {
      if (application.status !== "Submitted") {
        throw new AppError(
          "Only submitted mortgage applications can enter document verification.",
          400,
        );
      }

      application.status =
        "Document Verification";

      actionName =
        "mortgage.application.verification_started";

      description =
  `Started document verification for ${auditSubject}.`;

      break;
    }

    case "complete_verification": {
      if (
        application.status !==
        "Document Verification"
      ) {
        throw new AppError(
          "Only applications in document verification can move to credit assessment.",
          400,
        );
      }

      completeStage(
        application.stages,
        "Document Verification",
        actorId,
        now,
      );

      application.status =
        "Credit Assessment";

      actionName =
        "mortgage.application.credit_assessment_started";

     description =
  `Moved ${auditSubject} to credit assessment.`;

      break;
    }

    case "approve": {
      if (
        application.status !==
        "Credit Assessment"
      ) {
        throw new AppError(
          "Only applications in credit assessment can be approved.",
          400,
        );
      }

      if (!application.property) {
        throw new AppError(
          "The property linked to this application is missing.",
          500,
        );
      }

      if (
        Number(
          workflowData.approvedLoanAmount,
        ) >
        Number(application.property.price)
      ) {
        throw new AppError(
          "Approved loan amount cannot exceed the property's current price.",
          400,
        );
      }

      application.approvedLoanAmount =
        workflowData.approvedLoanAmount;

      application.interestRate =
        workflowData.interestRate;

      application.loanTermYears =
        workflowData.loanTermYears;

      application.monthlyPayment =
        workflowData.monthlyPayment;

      application.status = "Approved";
      application.approvedAt = now;

      completeStage(
        application.stages,
        "Credit Assessment",
        actorId,
        now,
      );

      completeStage(
        application.stages,
        "Approval & Offer",
        actorId,
        now,
      );

      actionName =
        "mortgage.application.approved";

   description =
  `Approved mortgage application for ${auditSubject}.`;

      break;
    }

    case "reject": {
      if (
        application.status !==
        "Credit Assessment"
      ) {
        throw new AppError(
          "Only applications in credit assessment can be rejected.",
          400,
        );
      }

      completeStage(
        application.stages,
        "Credit Assessment",
        actorId,
        now,
      );

      application.status = "Rejected";
      application.rejectedBy = actorId;
      application.rejectedAt = now;
      application.rejectionReason =
        workflowData.rejectionReason;

      actionName =
        "mortgage.application.rejected";

    description =
  `Rejected mortgage application for ${auditSubject}.`;

      break;
    }

    case "disburse": {
      if (application.status !== "Approved") {
        throw new AppError(
          "Only approved mortgage applications can be marked as disbursed.",
          400,
        );
      }

      application.status = "Disbursed";
      application.disbursedAt = now;

      completeStage(
        application.stages,
        "Disbursement",
        actorId,
        now,
      );

      actionName =
        "mortgage.application.disbursed";

    description =
  `Marked ${auditSubject} as disbursed.`;

      break;
    }

    default:
      throw new AppError(
        "Unsupported mortgage workflow action.",
        400,
      );
  }

  await application.save();

  await auditLogService.createAuditLog({
    req,
    action: actionName,
    category: "Finance",
    description,
    targetType: "MortgageApplication",
    targetId: application._id,
    targetName:
      application.property?.title ||
      `Mortgage Application ${application._id}`,
    metadata: {
      previousStatus,
      newStatus: application.status,
      workflowAction: workflowData.action,
      approvedLoanAmount:
        application.approvedLoanAmount,
      interestRate:
        application.interestRate,
      loanTermYears:
        application.loanTermYears,
      monthlyPayment:
        application.monthlyPayment,
      rejectionReason:
        application.rejectionReason || null,
    },
  });

  return MortgageApplication.findById(
    application._id,
  )
    .populate(
      "buyer",
      "fullName email phone role",
    )
    .populate(
      "property",
      "title price transactionType status availabilityStatus",
    )
    .populate(
      "stages.completedBy",
      "fullName role",
    )
    .populate(
      "rejectedBy",
      "fullName role",
    );
};

// Export the Mortgage service functions for the controller to use.
module.exports = {
  createMortgageApplication,
  getMortgageApplicationsByBuyer,
  getMortgageApplicationsForOperations,
  processMortgageApplication,
};