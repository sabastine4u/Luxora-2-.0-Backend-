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