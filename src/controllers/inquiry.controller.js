 // Import the Inquiry service containing the business rules.
const inquiryService = require("../services/inquiry.service");

// Import the centralized API response helper.
const api = require("../utils/api-response");

// Create a new property inquiry.
exports.createInquiry = async (
  req,
  res,
  next,
) => {
  try {
    // Pass the submitted inquiry fields and authenticated user to the service.
    const inquiry =
      await inquiryService.createInquiry(
        req.body,
        req.user || null,
      );

    // Return the newly created Inquiry with HTTP 201.
    return api.created(
      res,
      { inquiry },
      "Inquiry submitted successfully",
    );
  } catch (error) {
    // Forward service/database errors to the global error middleware.
    next(error);
  }
};

// Retrieve the authenticated Agency's inquiry pipeline.
exports.getAgencyInquiries = async (
  req,
  res,
  next,
) => {
  try {
    // Let the service enforce Agency ownership and access rules.
    const inquiries =
      await inquiryService.getAgencyInquiries(
        req.user,
      );

    // Return the real inquiry collection.
    return api.success(
      res,
      { inquiries },
      "Agency inquiries retrieved successfully",
    );
  } catch (error) {
    // Forward service/database errors to the global error middleware.
    next(error);
  }
};

// Retrieve the authenticated Agent's Lead pipeline.
exports.getAgentInquiries = async (
  req,
  res,
  next,
) => {
  try {
    // Let the service enforce Agent ownership and access rules.
    const inquiries =
      await inquiryService.getAgentInquiries(
        req.user,
      );

    // Return the Agent's real Lead collection.
    return api.success(
      res,
      { inquiries },
      "Agent inquiries retrieved successfully",
    );
  } catch (error) {
    // Forward service/database errors to the global error middleware.
    next(error);
  }
};

// Retrieve the authenticated Agent's real CRM-style client list.
exports.getAgentClients = async (
  req,
  res,
  next,
) => {
  try {
    // Ask the service to build clients from inquiries owned by this Agent.
    const clients =
      await inquiryService.getAgentClients(
        req.user,
      );

    return api.success(
      res,
      { clients },
      "Agent clients retrieved successfully",
    );
  } catch (error) {
    // Forward controlled and unexpected errors to the global error handler.
    next(error);
  }
};

// Retrieve all scheduled viewing appointments for the authenticated Agent.
exports.getAgentAppointments = async (
  req,
  res,
  next,
) => {
  try {
    // Ask the service for the Agent's real scheduled viewing appointments.
    const appointments =
      await inquiryService.getAgentAppointments(
        req.user,
      );

    // Return the real appointment collection.
    return api.success(
      res,
      { appointments },
      "Agent appointments retrieved successfully",
    );
  } catch (error) {
    // Forward service/database errors to the global error middleware.
    next(error);
  }
};

// Update the status of a Lead belonging to the authenticated Agent.
exports.updateAgentInquiryStatus = async (
  req,
  res,
  next,
) => {
  try {
    // Pass the Lead ID, requested status, optional note, and authenticated User to the service.
    const inquiry =
      await inquiryService.updateAgentInquiryStatus(
        req.params.inquiryId,
        req.body.status,
        req.body.note,
        req.user,
      );

    return api.success(
      res,
      { inquiry },
      "Lead status updated successfully",
    );
  } catch (error) {
    // Forward validation, authorization, and database errors.
    next(error);
  }
};

// Update the appointment status for the authenticated Agent.
exports.updateAgentAppointmentStatus =
  async (
    req,
    res,
    next,
  ) => {
    try {
      // Read the requested appointment lifecycle status.
      const {
        appointmentStatus,
      } = req.body;

      // Pass the authenticated User, Inquiry ID, and appointment status to the service.
      const appointment =
        await inquiryService.updateAgentAppointmentStatus(
          req.user,
          req.params.inquiryId,
          appointmentStatus,
        );

      // Return the updated appointment/inquiry record.
      return api.success(
        res,
        { appointment },
        "Appointment status updated successfully",
      );
    } catch (error) {
      // Forward validation, authorization, and database errors.
      next(error);
    }
  };

// Add a note to a Lead belonging to the authenticated Agent.
exports.addAgentInquiryNote = async (
  req,
  res,
  next,
) => {
  try {
    // Pass the Lead ID, note content, and authenticated User to the service.
    const inquiry =
      await inquiryService.addAgentInquiryNote(
        req.params.inquiryId,
        req.body.note,
        req.user,
      );

    return api.success(
      res,
      { inquiry },
      "Lead note added successfully",
    );
  } catch (error) {
    // Forward validation, authorization, and database errors.
    next(error);
  }
};

// Schedule or reschedule a viewing for an Agent Lead.
exports.scheduleAgentInquiryViewing = async (
  req,
  res,
  next,
) => {
  try {
    // Pass the requested schedule information to the service.
    const inquiry =
      await inquiryService.scheduleAgentInquiryViewing(
        req.params.inquiryId,
        req.body.scheduledDate,
        req.body.scheduledTime,
        req.body.note,
        req.user,
      );

    return api.success(
      res,
      { inquiry },
      "Lead viewing scheduled successfully",
    );
  } catch (error) {
    // Forward validation, authorization, and database errors.
    next(error);
  }
};