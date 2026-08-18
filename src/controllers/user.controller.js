const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const api = require('../utils/api-response');
const { ROLES } = require('../config/constants');

// POST /api/v1/users/admin
// Only reachable by a Super Admin (enforced by restrictTo in the route, not here).
// Creates a new Admin account - this is how Admins get created, since the public
// /auth/register endpoint deliberately refuses anything but Buyer/Owner.
exports.createAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, department } = req.body;

    if (!fullName || !email || !password) {
      return next(new AppError('fullName, email, and password are required', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already exists', 409));
    }

    // Role is hardcoded here, never taken from req.body - this endpoint has exactly
    // one job: create Admins. Nobody can trick it into creating a Super Admin.
    const admin = await User.create({
      fullName,
      email,
      password,
      role: ROLES.ADMIN,
      department: department || null,
    });

    const adminResponse = {
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      department: admin.department,
    };

    return api.created(res, { user: adminResponse }, 'Admin account created successfully');
  } catch (error) {
    next(error);
  }
};

const INTERNAL_ROLES = [
  ROLES.MANAGER,
  ROLES.PROCUREMENT,
  ROLES.FINANCE,
  ROLES.ANALYST,
  ROLES.PROPERTY_MANAGER,
  ROLES.SERVICE_ADMIN,
];

// POST /api/v1/users/internal-staff
// Reachable by Admin or Super Admin (enforced in the route).
// Unlike createAdmin, role IS taken from the request body - but strictly
// whitelisted to only these 6 internal roles, nothing else is accepted.
exports.createInternalStaff = async (req, res, next) => {
  try {
    const { fullName, email, password, role, department } = req.body;

    if (!fullName || !email || !password || !role) {
      return next(new AppError('fullName, email, password, and role are required', 400));
    }

    if (!INTERNAL_ROLES.includes(role)) {
      return next(new AppError('Invalid role for internal staff provisioning', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already exists', 409));
    }

    const staff = await User.create({
      fullName,
      email,
      password,
      role,
      department: department || null,
    });

    const staffResponse = {
      id: staff._id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      department: staff.department,
    };

    return api.created(res, { user: staffResponse }, 'Internal staff account created successfully');
  } catch (error) {
    next(error);
  }
};