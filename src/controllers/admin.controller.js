const User = require('../models/user.model');
const Agency = require('../models/agency.model');
const Agent = require('../models/agent.model');
const AppError = require('../utils/AppError');
const api = require('../utils/api-response');
const { ROLES } = require('../config/constants');

// Return every Agent on the platform for Admin/Super Admin management.
exports.getAllAgents = async (req, res, next) => {
  try {
    // Fetch all Agent profiles and include the Agency name for the Admin table.
    const agents = await Agent.find()
      .populate('agency', 'name')
      .sort({ createdAt: -1 });

    // Return the real Agent records using the project's standard response helper.
    return api.success(
      res,
      { agents },
      'Admin agents retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Return every Agency profile for Admin/Super Admin management.
exports.getAllAgencies = async (req, res, next) => {
  try {
    // Fetch every Agency and include the number of Agents currently attached to it.
    const agencies = await Agency.aggregate([
      // Keep all Agency documents.
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: 'agency',
          as: 'agents',
        },
      },

      // Convert the Agent array into a numeric count for the dashboard.
      {
        $addFields: {
          agentCount: { $size: '$agents' },
        },
      },

      // Remove the potentially large Agent array from the response.
      {
        $project: {
          agents: 0,
        },
      },

      // Show the newest Agencies first.
      {
        $sort: { createdAt: -1 },
      },
    ]);

    // Return the real Agency records with their calculated Agent counts.
    return api.success(
      res,
      { agencies },
      'Admin agencies retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Return only the six approved Internal Staff roles.
exports.getAllInternalStaff = async (req, res, next) => {
  try {
    // Define the same six internal roles already used during provisioning.
    const internalRoles = [
      ROLES.MANAGER,
      ROLES.PROCUREMENT,
      ROLES.FINANCE,
      ROLES.ANALYST,
      ROLES.PROPERTY_MANAGER,
      ROLES.SERVICE_ADMIN,
    ];

    // Fetch only Users belonging to those six internal roles.
    const staff = await User.find({
      role: { $in: internalRoles },
    })
      .select('_id fullName email role department isActive isVerified createdAt')
      .sort({ createdAt: -1 });

    // Return the real Internal Staff accounts.
    return api.success(
      res,
      { staff },
      'Internal staff retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// PATCH /api/v1/admin/internal-staff/:id/verification
// Allows an Admin or Super Admin to change an Internal Staff account's verification state.
exports.updateInternalStaffVerification = async (req, res, next) => {
  try {
    // Read the requested verification value from the request body.
    const { isVerified } = req.body;

    // Only true or false are valid verification values.
    if (typeof isVerified !== 'boolean') {
      return next(
        new AppError(
          'isVerified must be true or false',
          400
        )
      );
    }

    // Keep this list synchronized with the six Internal Staff roles
    // already used by the provisioning endpoint.
    const internalRoles = [
      ROLES.MANAGER,
      ROLES.PROCUREMENT,
      ROLES.FINANCE,
      ROLES.ANALYST,
      ROLES.PROPERTY_MANAGER,
      ROLES.SERVICE_ADMIN,
    ];

    // Update only a User belonging to one of the approved Internal Staff roles.
    const staff = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: { $in: internalRoles },
      },
      {
        isVerified,
      },
      {
        new: true,
      }
    ).select(
      '_id fullName email role department isVerified isActive createdAt'
    );

    // Return a 404 if the supplied ID is not an Internal Staff account.
    if (!staff) {
      return next(
        new AppError(
          'Internal staff account not found',
          404
        )
      );
    }

    // Return the updated staff account to the frontend.
    return api.success(
      res,
      { user: staff },
      'Internal staff verification updated successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};

// GET /api/v1/admin/buyers
// Lists every Buyer account on the platform.
exports.getAllBuyers = async (req, res, next) => {
  try {
    const buyers = await User.find({ role: ROLES.BUYER }).sort({ createdAt: -1 });
    return api.success(res, { buyers }, 'Buyers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/owners
// Lists every Owner account on the platform.
exports.getAllOwners = async (req, res, next) => {
  try {
    const owners = await User.find({ role: ROLES.OWNER }).sort({ createdAt: -1 });
    return api.success(res, { owners }, 'Owners retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/admins
// Lists every Admin account for Super Admin management.
exports.getAllAdmins = async (req, res, next) => {
  try {
    // Fetch only users whose role is exactly Admin.
    const admins = await User.find({
      role: ROLES.ADMIN,
    })
      // Return only fields that currently exist on the User model and are needed by the dashboard.
      .select(
        '_id fullName email role department isActive isVerified createdAt'
      )
      // Show the newest Admin accounts first.
      .sort({ createdAt: -1 });

    // Return the real Admin accounts to the Super Admin dashboard.
    return api.success(
      res,
      { admins },
      'Admins retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};