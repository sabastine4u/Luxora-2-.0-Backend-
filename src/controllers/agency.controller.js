const crypto = require('crypto');
const User = require('../models/user.model');
const Agency = require('../models/agency.model');
const AppError = require('../utils/AppError');
const api = require('../utils/api-response');
const { ROLES } = require('../config/constants');

exports.createAgency = async (req, res, next) => {
  let agencyUser; // declared here so the catch block can see it if we need to clean up

  try {
    const { agencyName, contactPerson, email, phone } = req.body;

    if (!agencyName || !contactPerson || !email) {
      return next(new AppError('agencyName, contactPerson, and email are required', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already exists', 409));
    }

    const temporaryPassword = crypto.randomBytes(6).toString('hex');

    // 1. The login identity
    agencyUser = await User.create({
      fullName: contactPerson,
      email,
      password: temporaryPassword,
      role: ROLES.AGENCY,
    });

    // 2. The business profile - if THIS fails, the catch block below
    // removes the User we just created, instead of leaving it orphaned.
    const agency = await Agency.create({
      name: agencyName,
      contactPerson,
      email,
      phone,
      user: agencyUser._id,
      createdBy: req.user._id,
    });

    return api.created(
      res,
      {
        agency: {
          id: agency._id,
          name: agency.name,
          contactPerson: agency.contactPerson,
          email: agency.email,
          status: agency.status,
        },
        temporaryPassword,
      },
      'Agency created successfully'
    );
  } catch (error) {
    // Manual rollback: if Agency.create() failed after User.create() already
    // succeeded, remove that orphaned User rather than leaving a broken half-record.
    if (agencyUser) {
      await User.findByIdAndDelete(agencyUser._id).catch(() => {});
    }
    next(error);
  }
};

// GET /api/v1/agencies/me
// Return the Agency business profile linked to the authenticated Agency user.
exports.getMyAgency = async (req, res, next) => {
  try {
    // Find the Agency document through its linked User account.
    const agency = await Agency.findOne({
      user: req.user._id,
    });

    // The authenticated Agency user must have a corresponding Agency profile.
    if (!agency) {
      return next(
        new AppError("Agency profile not found", 404),
      );
    }

    // Return only the Agency profile data needed by the dashboard.
    return api.success(
      res,
      {
        agency: {
          id: agency._id,
          name: agency.name,
          contactPerson: agency.contactPerson,
          email: agency.email,
          phone: agency.phone,
          status: agency.status,
          createdAt: agency.createdAt,
          updatedAt: agency.updatedAt,
        },
      },
      "Agency profile retrieved successfully",
    );
  } catch (error) {
    // Pass unexpected database errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/agencies/me
// Update the Agency business profile linked to the authenticated user.
exports.updateMyAgency = async (req, res, next) => {
  try {
    const {
      name,
      contactPerson,
      email,
      phone,
    } = req.body;

    // Require at least one editable Agency field.
    if (
      name === undefined &&
      contactPerson === undefined &&
      email === undefined &&
      phone === undefined
    ) {
      return next(
        new AppError(
          "At least one Agency profile field is required",
          400,
        ),
      );
    }

    // Find the Agency belonging to the authenticated user.
    const agency = await Agency.findOne({
      user: req.user._id,
    });

    if (!agency) {
      return next(
        new AppError("Agency profile not found", 404),
      );
    }

    // Validate and normalize the supplied Agency name.
    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return next(
          new AppError(
            "Agency name must be a valid value",
            400,
          ),
        );
      }

      agency.name = name.trim();
    }

    // Validate and normalize the contact person.
    if (contactPerson !== undefined) {
      if (
        typeof contactPerson !== "string" ||
        !contactPerson.trim()
      ) {
        return next(
          new AppError(
            "Contact person must be a valid value",
            400,
          ),
        );
      }

      agency.contactPerson =
        contactPerson.trim();
    }

    // Validate and normalize the Agency business email.
    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        return next(
          new AppError(
            "Business email must be a valid value",
            400,
          ),
        );
      }

      agency.email =
        email.trim().toLowerCase();
    }

    // Phone is optional, so an empty value is allowed.
    if (phone !== undefined) {
      if (
        phone !== null &&
        typeof phone !== "string"
      ) {
        return next(
          new AppError(
            "Business phone must be a valid value",
            400,
          ),
        );
      }

      agency.phone =
        phone === null
          ? null
          : phone.trim();
    }

// Keep the linked User account synchronized with the Agency profile.
if (contactPerson !== undefined) {
  req.user.fullName = agency.contactPerson;
}

if (email !== undefined) {
  req.user.email = agency.email;
}

if (phone !== undefined) {
  req.user.phone = agency.phone;
}

// Persist the Agency business profile first.
await agency.save();

// Persist the synchronized authenticated User account.
await req.user.save();

// Return the updated Agency profile.
return api.success(
      res,
      {
        agency: {
          id: agency._id,
          name: agency.name,
          contactPerson: agency.contactPerson,
          email: agency.email,
          phone: agency.phone,
          status: agency.status,
          createdAt: agency.createdAt,
          updatedAt: agency.updatedAt,
        },
      },
      "Agency profile updated successfully",
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};