const crypto = require('crypto');
const User = require('../models/user.model');
const Agency = require('../models/agency.model');
const Agent = require('../models/agent.model');
const AppError = require('../utils/AppError');
const api = require('../utils/api-response');
const { ROLES } = require('../config/constants');

exports.createAgent = async (req, res, next) => {
  let agentUser;

  try {
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      residentialAddress,

      employmentType,
      yearsOfExperience,
      licenseNumber,
      backgroundCheckStatus,

      branch,
      department,
      level,
      reportingManager,

      serviceStates,
      neighborhoods,
      coverageRadius,

      specializations,

      commissionModel,
      agentShare,
      agencyShare,
      signOnBonus,
    } = req.body;

    // -----------------------------------------
    // 1. Required fields
    // -----------------------------------------

    if (!fullName || !email) {
      return next(
        new AppError('fullName and email are required', 400)
      );
    }

    // -----------------------------------------
    // 2. Find the Agency represented by the
    //    currently authenticated User
    // -----------------------------------------

    const agency = await Agency.findOne({
      user: req.user._id,
    });

    if (!agency) {
      return next(
        new AppError('No agency profile found for this account', 404)
      );
    }

    // -----------------------------------------
    // 3. Prevent duplicate login accounts
    // -----------------------------------------

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return next(
        new AppError('Email already exists', 409)
      );
    }

    // -----------------------------------------
    // 4. Generate temporary login password
    // -----------------------------------------

    const temporaryPassword = crypto
      .randomBytes(6)
      .toString('hex');

    // -----------------------------------------
    // 5. Create the Agent's login identity
    // -----------------------------------------

    agentUser = await User.create({
      fullName,
      email,
      password: temporaryPassword,
      role: ROLES.AGENT,
    });

    // -----------------------------------------
    // 6. Create the Agent profile
    // -----------------------------------------

    const agent = await Agent.create({
      fullName,
      email,
      phone,

      dateOfBirth,
      residentialAddress,

      employmentType,
      yearsOfExperience,
      licenseNumber,
      backgroundCheckStatus,

      branch,
      department,
      level,
      reportingManager,

      serviceStates,
      neighborhoods,
      coverageRadius,

      specializations,

      commissionModel,
      agentShare,
      agencyShare,
      signOnBonus,

      user: agentUser._id,
      agency: agency._id,
    });

    // -----------------------------------------
    // 7. Return useful information
    // -----------------------------------------

    return api.created(
      res,
      {
        agent: {
          id: agent._id,
          fullName: agent.fullName,
          email: agent.email,
          phone: agent.phone,

          employmentType: agent.employmentType,
          yearsOfExperience: agent.yearsOfExperience,
          licenseNumber: agent.licenseNumber,
          backgroundCheckStatus: agent.backgroundCheckStatus,

          branch: agent.branch,
          department: agent.department,
          level: agent.level,
          reportingManager: agent.reportingManager,

          serviceStates: agent.serviceStates,
          neighborhoods: agent.neighborhoods,
          coverageRadius: agent.coverageRadius,

          specializations,

          commissionModel: agent.commissionModel,
          agentShare: agent.agentShare,
          agencyShare: agent.agencyShare,
          signOnBonus: agent.signOnBonus,

          status: agent.status,

          agency: {
            id: agency._id,
            name: agency.name,
          },
        },

        temporaryPassword,
      },
      'Agent created successfully'
    );
  } catch (error) {
    // -----------------------------------------
    // Roll back the User if Agent creation fails
    // -----------------------------------------

    if (agentUser) {
      await User.findByIdAndDelete(agentUser._id).catch(() => {});
    }

    next(error);
  }
};

// GET /api/v1/agents
// Returns every Agent belonging to the currently logged-in Agency.
// (Later, Admin/Super Admin might see across all agencies - not needed yet.)
exports.getAgents = async (req, res, next) => {
  try {
    // Same lookup as createAgent: find the Agency profile behind this login
    const agency = await Agency.findOne({ user: req.user._id });
    if (!agency) {
      return next(new AppError('No agency profile found for this account', 404));
    }

    const agents = await Agent.find({ agency: agency._id }).sort({ createdAt: -1 });

    return api.success(res, { agents }, 'Agents retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/agents/:id/status
// Changes an Agent's status (e.g. Pending Verification -> Active, or -> Suspended).
// Only the Agency that owns this Agent can change it - we verify that below,
// not just trust whoever is logged in.
exports.updateAgentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Reuse the same allowed values already defined on the Agent model's enum,
    // so this can never be set to something the schema wouldn't accept anyway.
    const ALLOWED_STATUSES = ['Pending Verification', 'Active', 'Suspended'];
    if (!ALLOWED_STATUSES.includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }

    // Find which Agency is making this request
    const agency = await Agency.findOne({ user: req.user._id });
    if (!agency) {
      return next(new AppError('No agency profile found for this account', 404));
    }

    // IMPORTANT: find the agent by BOTH its id AND agency in one query.
    // This means an Agency can only ever update agents that actually belong
    // to them - Agency B can never touch Agency A's agents, even if they
    // guess a valid agent id.
    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, agency: agency._id },
      { status },
      { new: true } // return the UPDATED document, not the old one
    );

    if (!agent) {
      return next(new AppError('Agent not found', 404));
    }

    return api.success(res, { agent }, 'Agent status updated successfully');
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/agents/:id/commission
// Updates the commission configuration for an Agent owned by the authenticated Agency.
exports.updateAgentCommission = async (req, res, next) => {
  try {
    const {
      commissionModel,
      agentShare,
      agencyShare,
      signOnBonus,
    } = req.body;

    // Validate the commission split before saving it.
    const agentPercentage = Number(agentShare);
    const agencyPercentage = Number(agencyShare);

    if (
      !Number.isFinite(agentPercentage) ||
      !Number.isFinite(agencyPercentage)
    ) {
      return next(
        new AppError(
          'agentShare and agencyShare must be valid numbers',
          400
        )
      );
    }

    // Prevent invalid negative or over-100% commission values.
    if (
      agentPercentage < 0 ||
      agencyPercentage < 0 ||
      agentPercentage > 100 ||
      agencyPercentage > 100
    ) {
      return next(
        new AppError(
          'Commission shares must be between 0 and 100',
          400
        )
      );
    }

    // The Agent and Agency portions must always make up the entire pool.
    if (agentPercentage + agencyPercentage !== 100) {
      return next(
        new AppError(
          'agentShare and agencyShare must total 100%',
          400
        )
      );
    }

    // Find the Agency represented by the authenticated User.
    const agency = await Agency.findOne({
      user: req.user._id,
    });

    if (!agency) {
      return next(
        new AppError(
          'No agency profile found for this account',
          404
        )
      );
    }

    // Update only an Agent belonging to this Agency.
    const agent = await Agent.findOneAndUpdate(
      {
        _id: req.params.id,
        agency: agency._id,
      },
      {
        commissionModel,
        agentShare: agentPercentage,
        agencyShare: agencyPercentage,
        signOnBonus:
          signOnBonus === undefined
            ? 0
            : Number(signOnBonus),
      },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );

    // Prevent cross-Agency Agent updates.
    if (!agent) {
      return next(
        new AppError('Agent not found', 404)
      );
    }

    return api.success(
      res,
      { agent },
      'Agent commission settings updated successfully'
    );
  } catch (error) {
    next(error);
  }
};