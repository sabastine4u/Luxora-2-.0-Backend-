// Import the Mortgage Application model so we can create and retrieve applications.
const MortgageApplication = require("../models/mortgage-application.model");

// Import the Property model so we can verify the property being financed.
const Property = require("../models/property.model");

// Import AppError so predictable business-rule failures use the centralized error handler.
const AppError = require("../utils/AppError");

// Create the initial timeline used for a newly submitted mortgage application.
const buildInitialStages = () => {
  // Record the first application stage when the Buyer submits the application.
  return [
    {
      label: "Application Submitted",
      date: new Date(),
      completed: true,
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
    stages: buildInitialStages(),
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

// Export the Mortgage service functions for the controller to use.
module.exports = {
  createMortgageApplication,
  getMortgageApplicationsByBuyer,
};