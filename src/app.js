const express = require("express");
const authRoutes = require("./routes/auth.routes");
const app = express();
const globalErrorHandler = require("./middleware/error.middleware");
const cors = require("cors");
const registerEventListeners = require("./events/register-listeners");
// Import the protected Buyer Favorites routes.
const favoriteRoutes = require("./routes/favorite.routes");
// Import the routes used for Buyer viewing requests.
const bookingRoutes = require("./routes/booking.routes");
// Import the routes that handle Buyer Offer operations.
const offerRoutes = require("./routes/offer.routes");
// Import the Deal routes used by Buyer, Owner, Agent, Agency and oversight dashboards.
const dealRoutes = require("./routes/deal.routes");
const managementRoutes =
  require("./routes/management.routes");
const reportArchiveRoutes = require("./routes/report-archive.routes");
const marketplaceRoutes = require("./routes/marketplace.routes");
// Import the Owner analytics routes.
const analyticsRoutes = require("./routes/analytics.routes");
const reportRoutes = require("./routes/report.routes");
// Import the Agency Commission routes.
const commissionRoutes = require("./routes/commission.routes");
const auditLogRoutes = require("./routes/audit-log.routes");
// Import the rental payment routes used by the Owner Rental Income feature.
const paymentRoutes = require("./routes/payment.routes");
const mortgageRoutes = require("./routes/mortgage.routes");
const userRoutes = require("./routes/user.routes"); // Handles Super-Admin-only account provisioning (currently: create Admin accounts)
const agencyRoutes = require("./routes/agency.routes");
const agentRoutes = require("./routes/agent.routes");
const adminRoutes = require("./routes/admin.routes");
const complaintRoutes = require("./routes/complaint.routes");
// Import Property routes for the Property marketplace API.
const propertyRoutes = require("./routes/property.routes");
const propertyCategoryRoutes = require("./routes/property-category.routes");
// Import the routes used by the Contact Agent and Agency inquiry workflow.
const inquiryRoutes = require("./routes/inquiry.routes");
const conversationRoutes = require("./routes/conversation.routes");
const messageRoutes = require("./routes/message.routes");
const notificationRoutes = require("./routes/notification.routes");
// Import Property approval routes for the review workflow.
const approvalRoutes = require("./routes/approval.routes");
const departmentRoutes =
  require("./routes/department.routes");
// Import Admin/Super Admin Verification Center routes.
const verificationRoutes = require('./routes/verification.routes');
// Import upload routes for Property image and document uploads.
const uploadRoutes = require("./routes/upload.routes");
const path = require("path");

// Register in-process domain listeners once when the application is loaded.
registerEventListeners();

// Import the Agency Performance routes.
const performanceRoutes = require("./routes/performance.routes");
const propertyLocationRoutes = require("./routes/property-location.routes");
const homeServicesRoutes = require("./routes/home-services.routes");
const procurementRoutes = require("./routes/procurement.routes");
const financeRoutes = require("./routes/finance.routes");
const superAdminRoutes = require("./routes/super-admin.routes");
const intelligenceRoutes = require("./routes/intelligence.routes");
const propertyManagementRoutes = require("./routes/property-management.routes");

// Allow the frontend (Vite dev server) to talk to this backend
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
// Middleware to parse JSON requests
app.use(express.json());

// Serve uploaded Property media and authenticated user profile pictures
// from dedicated public subfolders rather than exposing the entire uploads directory.
app.use(
  "/uploads/properties",
  express.static(path.join(__dirname, "..", "uploads", "properties")),
);
app.use(
  "/uploads/documents",
  express.static(path.join(__dirname, "..", "uploads", "documents")),
);

// Serve authenticated user profile pictures from the dedicated users folder.
app.use(
  "/uploads/users",
  express.static(path.join(__dirname, "..", "uploads", "users")),
);

// Define a simple route for the root URL
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Luxora Backend",
  });
});

app.use("/api/v1/auth", authRoutes);
// User/account provisioning: currently just POST /api/v1/users/admin,
// restricted to Super Admin only (see user.routes.js)
app.use("/api/v1/users", userRoutes);
// Mount the Buyer Favorites API.
app.use("/api/v1/favorites", favoriteRoutes);
// Mount the Buyer viewing-request endpoints.
app.use("/api/v1/bookings", bookingRoutes);
// Mount the Buyer Offer routes under the /api/v1/offers endpoint.
app.use("/api/v1/offers", offerRoutes);

// Mount the Deal API under the versioned /api/v1/deals namespace.
app.use("/api/v1/deals", dealRoutes);
// Mount the Owner analytics API.
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1", reportArchiveRoutes);
app.use(
  "/api/v1",
  departmentRoutes,
);

// Register the rental payment API under the /api/v1/payments endpoint.
app.use("/api/v1/payments", paymentRoutes);

// Mount the Buyer Mortgage routes under the /api/v1/mortgages endpoint.
app.use("/api/v1/mortgages", mortgageRoutes);
app.use("/api/v1", agencyRoutes);
app.use("/api/v1", agentRoutes);
app.use("/api/v1", adminRoutes);
app.use(
  "/api/v1",
  managementRoutes,
);
app.use("/api/v1", reportRoutes);
app.use("/api/v1", complaintRoutes);
app.use(
  "/api/v1",
  auditLogRoutes,
);
// Mount Admin/Super Admin Verification Center routes.
app.use('/api/v1', verificationRoutes);
// Mount the Agency Commission API after CORS middleware has been registered.
app.use("/api/v1", commissionRoutes);
// Mount public marketplace summary data used by the homepage Hero.
app.use("/api/v1", marketplaceRoutes);
// Mount Property routes under the versioned API namespace.
app.use("/api/v1", propertyRoutes);
app.use("/api/v1", propertyLocationRoutes);
app.use("/api/v1", propertyCategoryRoutes);
// Mount Inquiry routes under the dedicated inquiries API namespace.
app.use("/api/v1/inquiries", inquiryRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Mount Property approval routes under the versioned API namespace.
app.use("/api/v1", approvalRoutes);
// Mount upload routes under the versioned API namespace.
app.use("/api/v1", uploadRoutes);
// Mount the Agency Performance API.
app.use("/api/v1", performanceRoutes);
app.use("/api/v1", homeServicesRoutes);
app.use("/api/v1", procurementRoutes);
app.use("/api/v1", financeRoutes);
app.use("/api/v1/super-admin", superAdminRoutes);
app.use("/api/v1/intelligence", intelligenceRoutes);
app.use("/api/v1", propertyManagementRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
