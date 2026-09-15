// Import the Property model used by the Admin listing management workflow.
const Property = require('../models/property.model');

const User = require('../models/user.model');
const Agency = require('../models/agency.model');
const Agent = require('../models/agent.model');

const {
  createAuditLog,
} = require("../services/audit-log.service");

const Favorite = require('../models/favorite.model');
const Booking = require('../models/booking.model');
const Offer = require('../models/offer.model');
const SystemSettings = require('../models/system-settings.model');
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

    // Define the Property statuses that represent completed transactions.
    const finalizedStatuses = [
      'Sold',
      'Rented',
      'Leased',
    ];

    // Get all finalized Properties that have been handled by the Agents
    // returned by this Admin endpoint.
    const finalizedProperties = await Property.find({
      agent: {
        $in: agents.map(
          (agent) => agent._id
        ),
      },
      status: {
        $in: finalizedStatuses,
      },
    }).select('_id');

    // Create a set of finalized Property IDs for fast membership checks.
    const finalizedPropertyIds =
      new Set(
        finalizedProperties.map(
          (property) =>
            String(property._id)
        )
      );

    // Fetch accepted Offers belonging to the Agents returned above.
    const acceptedOffers =
      agents.length > 0
        ? await Offer.find({
            agent: {
              $in: agents.map(
                (agent) => agent._id
              ),
            },
            status: 'Accepted',
          }).select(
            'property agent'
          )
        : [];

    // Count completed deals for each Agent.
    //
    // A deal is counted only when:
    // 1. The Offer belongs to the Agent.
    // 2. The Offer status is Accepted.
    // 3. The related Property is Sold, Rented, or Leased.
    const dealCountMap =
      new Map();

    acceptedOffers.forEach(
      (offer) => {
        // Ignore incomplete Offer records without an Agent reference.
        if (!offer.agent) {
          return;
        }

        // Ignore accepted Offers whose Property has not been finalized.
        if (
          !offer.property ||
          !finalizedPropertyIds.has(
            String(offer.property)
          )
        ) {
          return;
        }

        // Use the Agent ID as the grouping key.
        const agentId =
          String(offer.agent);

        // Increase the completed deal count for this Agent.
        dealCountMap.set(
          agentId,
          (dealCountMap.get(
            agentId
          ) || 0) + 1
        );
      }
    );

    // Add the real completed deal count to every Agent.
    const agentsWithDealCounts =
      agents.map((agent) => ({
        ...agent.toObject(),

        // Return the real completed transaction count.
        // Zero is returned only when no finalized deal exists.
        dealCount:
          dealCountMap.get(
            String(agent._id)
          ) || 0,
      }));

    // Return the real Agent records with their calculated deal counts.
    return api.success(
      res,
      {
        agents: agentsWithDealCounts,
      },
      'Admin agents retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/agents/:id/status
// Allows an Admin or Super Admin to suspend or reactivate an Agent account.
exports.updateAgentStatus = async (req, res, next) => {
  try {
    // Read the requested Agent account status.
    const { status } = req.body;

    // Keep the allowed values synchronized with the Agent model.
    const allowedStatuses = [
      'Pending Verification',
      'Active',
      'Suspended',
    ];

    // Reject unsupported Agent status values.
    if (!allowedStatuses.includes(status)) {
      return next(
        new AppError(
          'Invalid Agent status value',
          400
        )
      );
    }

    // Update only the requested Agent record.
    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
        },
      },
      {
     returnDocument: 'after',
        runValidators: true,
      }
    ).populate(
      'agency',
      'name'
    );

    // Return a 404 when the Agent does not exist.
    if (!agent) {
      return next(
        new AppError(
          'Agent account not found',
          404
        )
      );
    }

    // Return the updated Agent to the Admin dashboard.
    return api.success(
      res,
      { agent },
      'Agent status updated successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/agents/:id
// Allows an Admin or Super Admin to edit an Agent's profile information.
exports.updateAgent = async (req, res, next) => {
  try {
    // Only allow profile fields that belong to the Agent record.
    const allowedFields = [
      'fullName',
      'email',
      'phone',
      'dateOfBirth',
      'residentialAddress',
      'employmentType',
      'yearsOfExperience',
      'licenseNumber',
      'backgroundCheckStatus',
      'branch',
      'department',
      'level',
      'reportingManager',
      'serviceStates',
      'neighborhoods',
      'coverageRadius',
      'specializations',
      'commissionModel',
      'agentShare',
      'agencyShare',
      'signOnBonus',
    ];

    // Build the update object from only approved fields.
    const updates = {};

    allowedFields.forEach((field) => {
      if (
        req.body[field] !==
        undefined
      ) {
        updates[field] =
          req.body[field];
      }
    });

    // Prevent empty update requests.
    if (
      Object.keys(updates).length ===
      0
    ) {
      return next(
        new AppError(
          'No Agent profile fields were provided',
          400
        )
      );
    }

    // Update the requested Agent and return the updated record.
    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
      },
      {
       returnDocument: 'after',
        runValidators: true,
      }
    ).populate(
      'agency',
      'name'
    );

    // Return a 404 when the Agent does not exist.
    if (!agent) {
      return next(
        new AppError(
          'Agent not found',
          404
        )
      );
    }

    // Return the updated Agent to the frontend.
    return api.success(
      res,
      { agent },
      'Agent profile updated successfully'
    );
  } catch (error) {
    // Pass unexpected database/validation errors to the global error handler.
    next(error);
  }
};


// Return every Agency profile for Admin/Super Admin management.
exports.getAllAgencies = async (req, res, next) => {
  try {
    // Fetch every Agency and calculate both:
    // 1. the number of Agents attached to it
    // 2. the number of Properties attached to it
    const agencies = await Agency.aggregate([
      // Find all Agents belonging to each Agency.
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: 'agency',
          as: 'agents',
        },
      },

      // Find all Properties belonging to each Agency.
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: 'agency',
          as: 'properties',
        },
      },

      // Convert both arrays into dashboard counts.
      {
        $addFields: {
          agentCount: {
            $size: '$agents',
          },
          listingCount: {
            $size: '$properties',
          },
        },
      },

      // Do not return the full Agent/Property arrays.
      {
        $project: {
          agents: 0,
          properties: 0,
        },
      },

      // Show newest Agencies first.
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    // Return the real Agency records with calculated counts.
    return api.success(
      res,
      { agencies },
      'Admin agencies retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/agencies/:id
// Allows an Admin or Super Admin to edit an existing Agency profile.
exports.updateAgency = async (req, res, next) => {
  try {
    // Only these Agency profile fields are editable from Admin.
    const {
      name,
      contactPerson,
      email,
      phone,
      status,
    } = req.body;

    // Prevent an empty update request.
    if (
      name === undefined &&
      contactPerson === undefined &&
      email === undefined &&
      phone === undefined &&
      status === undefined
    ) {
      return next(
        new AppError(
          'At least one Agency profile field is required',
          400,
        ),
      );
    }

    // Find the Agency being edited.
    const agency = await Agency.findById(
      req.params.id,
    );

    // The Agency must exist.
    if (!agency) {
      return next(
        new AppError(
          'Agency not found',
          404,
        ),
      );
    }

    // Validate the Agency name when supplied.
    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return next(
          new AppError(
            'Agency name must be a valid value',
            400,
          ),
        );
      }

      agency.name = name.trim();
    }

    // Validate the contact person's name when supplied.
    if (contactPerson !== undefined) {
      if (
        typeof contactPerson !== 'string' ||
        !contactPerson.trim()
      ) {
        return next(
          new AppError(
            'Contact person must be a valid value',
            400,
          ),
        );
      }

      agency.contactPerson =
        contactPerson.trim();
    }

    // Validate and normalize the business email.
    if (email !== undefined) {
      if (
        typeof email !== 'string' ||
        !email.trim()
      ) {
        return next(
          new AppError(
            'Business email must be a valid value',
            400,
          ),
        );
      }

      agency.email =
        email.trim().toLowerCase();
    }

    // Phone is optional.
    if (phone !== undefined) {
      if (
        phone !== null &&
        typeof phone !== 'string'
      ) {
        return next(
          new AppError(
            'Business phone must be a valid value',
            400,
          ),
        );
      }

      agency.phone =
        phone === null
          ? null
          : phone.trim();
    }

    // Only use statuses supported by the Agency model.
    if (status !== undefined) {
      if (
        !['Active', 'Suspended'].includes(
          status,
        )
      ) {
        return next(
          new AppError(
            'Invalid Agency status',
            400,
          ),
        );
      }

      agency.status = status;
    }

    // Keep the Agency login User synchronized with the Agency profile.
    const agencyUser = await User.findById(
      agency.user,
    );

    if (!agencyUser) {
      return next(
        new AppError(
          'Linked Agency user account not found',
          404,
        ),
      );
    }

    // The Agency contact person is also the login user's name.
    if (contactPerson !== undefined) {
      agencyUser.fullName =
        agency.contactPerson;
    }

    // Keep the login email synchronized.
    if (email !== undefined) {
      agencyUser.email =
        agency.email;
    }

    // Keep the login phone synchronized.
    if (phone !== undefined) {
      agencyUser.phone =
        agency.phone;
    }

    // Keep the login account active/inactive with Agency status.
    if (status !== undefined) {
      agencyUser.isActive =
        status === 'Active';
    }

    // Save the Agency profile.
    await agency.save();

    // Save the linked User account.
    await agencyUser.save();

    // Return the updated Agency.
    return api.success(
      res,
      {
        agency: {
          _id: agency._id,
          name: agency.name,
          contactPerson:
            agency.contactPerson,
          email: agency.email,
          phone: agency.phone,
          status: agency.status,
          createdAt:
            agency.createdAt,
          updatedAt:
            agency.updatedAt,
        },
      },
      'Agency updated successfully',
    );
  } catch (error) {
    // Handle duplicate login email cleanly.
    if (
      error.code === 11000
    ) {
      return next(
        new AppError(
          'That email address is already in use',
          409,
        ),
      );
    }

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
      role: {
        $in: internalRoles,
      },
    })
      .select(
        '_id fullName email role department isActive isVerified createdAt'
      )
      .sort({
        createdAt: -1,
      });

    // Return the real Internal Staff accounts.
    return api.success(
      res,
      { staff },
      'Internal staff retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/internal-staff/:id
// Allows an Admin or Super Admin to edit an Internal Staff account.
exports.updateInternalStaff = async (
  req,
  res,
  next
) => {
  try {
    // These are the only User fields that the
    // Internal Staff "Edit Access" form can change.
    const {
      fullName,
      email,
      phone,
      role,
      department,
      isActive,
    } = req.body;

    // Keep this list synchronized with the
    // six approved Internal Staff roles.
    const internalRoles = [
      ROLES.MANAGER,
      ROLES.PROCUREMENT,
      ROLES.FINANCE,
      ROLES.ANALYST,
      ROLES.PROPERTY_MANAGER,
      ROLES.SERVICE_ADMIN,
    ];

    // Build an update object only from fields
    // that were actually supplied.
    const updates = {};

    if (fullName !== undefined) {
      if (
        typeof fullName !== "string" ||
        !fullName.trim()
      ) {
        return next(
          new AppError(
            "Full name must be a valid value",
            400
          )
        );
      }

      updates.fullName =
        fullName.trim();
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        return next(
          new AppError(
            "Email must be a valid value",
            400
          )
        );
      }

      updates.email =
        email.trim().toLowerCase();
    }

    if (phone !== undefined) {
      if (
        phone !== null &&
        typeof phone !== "string"
      ) {
        return next(
          new AppError(
            "Phone must be a valid value",
            400
          )
        );
      }

      updates.phone =
        phone === null
          ? null
          : phone.trim();
    }

    if (role !== undefined) {
      if (
        !internalRoles.includes(role)
      ) {
        return next(
          new AppError(
            "Invalid Internal Staff role",
            400
          )
        );
      }

      updates.role = role;
    }

    if (department !== undefined) {
      if (
        department !== null &&
        typeof department !== "string"
      ) {
        return next(
          new AppError(
            "Department must be a valid value",
            400
          )
        );
      }

      updates.department =
        department === null
          ? null
          : department.trim();
    }

    if (isActive !== undefined) {
      if (
        typeof isActive !== "boolean"
      ) {
        return next(
          new AppError(
            "isActive must be true or false",
            400
          )
        );
      }

      updates.isActive = isActive;
    }

    // Prevent empty update requests.
    if (
      Object.keys(updates).length ===
      0
    ) {
      return next(
        new AppError(
          "At least one Internal Staff field is required",
          400
        )
      );
    }

    /*
     * Update only a User who is currently
     * one of the approved Internal Staff roles.
     *
     * If the role itself is being changed, the
     * existing role is still what authorizes the
     * record to be edited.
     */
    const staff =
      await User.findOneAndUpdate(
        {
          _id: req.params.id,
          role: {
            $in: internalRoles,
          },
        },
        {
          $set: updates,
        },
        {
        returnDocument: 'after',
          runValidators: true,
        }
      ).select(
        "_id fullName email phone role department isActive isVerified createdAt"
      );

    // Return a 404 when the account does not exist
    // or is not an approved Internal Staff account.
    if (!staff) {
      return next(
        new AppError(
          "Internal staff account not found",
          404
        )
      );
    }

    // Return the updated staff member to the frontend.
    return api.success(
      res,
      { user: staff },
      "Internal staff updated successfully"
    );
  } catch (error) {
    // Handle duplicate email addresses cleanly.
    if (
      error.code === 11000
    ) {
      return next(
        new AppError(
          "That email address is already in use",
          409
        )
      );
    }

    // Pass all other errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/internal-staff/:id/verification
// Allows an Admin or Super Admin to change an Internal Staff account's verification state.
exports.updateInternalStaffVerification = async (
  req,
  res,
  next
) => {
  try {
    // Read the requested verification value from the request body.
    const { isVerified } = req.body;

    // Only true or false are valid verification values.
    if (
      typeof isVerified !==
      'boolean'
    ) {
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
        role: {
          $in: internalRoles,
        },
      },
      {
        isVerified,
      },
      {
       returnDocument: 'after',
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
// Lists every Buyer account together with real engagement data.
exports.getAllBuyers = async (
  req,
  res,
  next
) => {
  try {
    // Fetch every Buyer account, newest registrations first.
    const buyerUsers = await User.find({
      role: ROLES.BUYER,
    }).sort({
      createdAt: -1,
    });

    // Add real saved-property and viewing-request counts to each Buyer.
    const buyers = await Promise.all(
      buyerUsers.map(
        async (buyer) => {
          // Count the real Properties saved by this Buyer.
          const savedCount =
            await Favorite.countDocuments(
              {
                user: buyer._id,
              }
            );

          // Count the real viewing requests submitted by this Buyer.
          const bookingCount =
            await Booking.countDocuments(
              {
                buyer: buyer._id,
              }
            );

          // Find the Buyer's latest saved Property activity.
          const latestFavorite =
            await Favorite.findOne({
              user: buyer._id,
            }).sort({
              createdAt: -1,
            });

          // Find the Buyer's latest viewing-request activity.
          const latestBooking =
            await Booking.findOne({
              buyer: buyer._id,
            }).sort({
              createdAt: -1,
            });

          // Convert the available activity timestamps into numbers for comparison.
          const favoriteTime =
            latestFavorite?.createdAt
              ? new Date(
                  latestFavorite.createdAt
                ).getTime()
              : 0;

          const bookingTime =
            latestBooking?.createdAt
              ? new Date(
                  latestBooking.createdAt
                ).getTime()
              : 0;

          // Keep whichever Buyer activity happened most recently.
          const latestActivityTime =
            Math.max(
              favoriteTime,
              bookingTime
            );

          // Return the existing Buyer document plus real engagement fields.
          return {
            ...buyer.toObject(),

            // Real number of saved Properties.
            savedCount,

            // Real number of viewing requests.
            bookingCount,

            // Real latest engagement timestamp.
            lastActivityAt:
              latestActivityTime > 0
                ? new Date(
                    latestActivityTime
                  ).toISOString()
                : null,
          };
        }
      )
    );

    // Fetch recent saved-Property activity for the Admin activity panel.
    const recentFavorites =
      await Favorite.find()
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .populate(
          'user',
          'fullName'
        )
        .populate(
          'property',
          'title'
        );

    // Fetch recent viewing-request activity for the Admin activity panel.
    const recentBookings =
      await Booking.find()
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .populate(
          'buyer',
          'fullName'
        )
        .populate(
          'property',
          'title'
        );

    // Convert saved-property records into the frontend activity structure.
    const favoriteActivities =
      recentFavorites
        .filter(
          (favorite) =>
            favorite.user &&
            favorite.property
        )
        .map(
          (favorite) => ({
            type: 'favorite',
            title:
              'Property Saved',
            description: `${favorite.user.fullName} saved ${favorite.property.title}`,
            createdAt:
              favorite.createdAt.toISOString(),
          })
        );

    // Convert viewing requests into the frontend activity structure.
    const bookingActivities =
      recentBookings
        .filter(
          (booking) =>
            booking.buyer &&
            booking.property
        )
        .map(
          (booking) => ({
            type: 'booking',
            title:
              'Viewing Request',
            description: `${booking.buyer.fullName} requested a viewing for ${booking.property.title}`,
            createdAt:
              booking.createdAt.toISOString(),
          })
        );

    // Combine both real activity sources and keep the newest events.
    const activities = [
      ...favoriteActivities,
      ...bookingActivities,
    ]
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      )
      .slice(0, 10);

    // Return Buyers and real activity data to the Admin dashboard.
    return api.success(
      res,
      {
        buyers,
        activities,
      },
      'Buyers retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/buyers/:id
// Allows an Admin or Super Admin to edit an existing Buyer profile.
exports.updateBuyer = async (
  req,
  res,
  next
) => {
  try {
    // Read only the profile fields that the Admin Buyer form can edit.
    const {
      fullName,
      email,
      phone,
    } = req.body;

    // Build the update object only from fields supplied by the frontend.
    const updateData = {};

    if (
      typeof fullName ===
        'string' &&
      fullName.trim()
    ) {
      updateData.fullName =
        fullName.trim();
    }

    if (
      typeof email ===
        'string' &&
      email.trim()
    ) {
      updateData.email =
        email.trim().toLowerCase();
    }

    if (
      typeof phone ===
      'string'
    ) {
      updateData.phone =
        phone.trim();
    }

    // Prevent an empty update request.
    if (
      Object.keys(
        updateData
      ).length === 0
    ) {
      return next(
        new AppError(
          'At least one Buyer profile field is required',
          400
        )
      );
    }

    // Update only a User whose role is actually Buyer.
    const buyer =
      await User.findOneAndUpdate(
        {
          _id: req.params.id,
          role: ROLES.BUYER,
        },
        {
          $set: updateData,
        },
        {
         returnDocument: 'after',
          runValidators: true,
        }
      ).select(
        '_id fullName email phone role isActive isVerified createdAt lastLoginAt'
      );

    // Return 404 when the supplied ID does not belong to a Buyer.
    if (!buyer) {
      return next(
        new AppError(
          'Buyer account not found',
          404
        )
      );
    }

    // Return the updated Buyer to the frontend.
    return api.success(
      res,
      { user: buyer },
      'Buyer updated successfully'
    );
  } catch (error) {
    // Handle duplicate email addresses cleanly.
    if (
      error.code === 11000
    ) {
      return next(
        new AppError(
          'That email address is already in use',
          409
        )
      );
    }

    // Pass all other errors to the global error handler.
    next(error);
  }
};


// PATCH /api/v1/admin/buyers/:id/status
// Allows an Admin or Super Admin to suspend or reactivate a Buyer account.
exports.updateBuyerStatus = async (
  req,
  res,
  next
) => {
  try {
    // Read the requested account status.
    const { isActive } =
      req.body;

    // Only boolean values are valid for account status.
    if (
      typeof isActive !==
      'boolean'
    ) {
      return next(
        new AppError(
          'isActive must be true or false',
          400
        )
      );
    }

    // Update only the account status.
    // isVerified remains completely separate.
    const buyer =
      await User.findOneAndUpdate(
        {
          _id: req.params.id,
          role: ROLES.BUYER,
        },
        {
          $set: {
            isActive,
          },
        },
        {
        returnDocument: 'after',
        }
      ).select(
        '_id fullName email phone role isActive isVerified createdAt lastLoginAt'
      );

    // Return 404 when the supplied ID does not belong to a Buyer.
    if (!buyer) {
      return next(
        new AppError(
          'Buyer account not found',
          404
        )
      );
    }

    // Return the updated Buyer to the frontend.
    return api.success(
      res,
      { user: buyer },
      isActive
        ? 'Buyer account reactivated successfully'
        : 'Buyer account suspended successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// GET /api/v1/admin/owners
// Lists every Owner account on the platform.
exports.getAllOwners = async (
  req,
  res,
  next
) => {
  try {
    const owners = await User.find({
      role: ROLES.OWNER,
    }).sort({
      createdAt: -1,
    });

    return api.success(
      res,
      { owners },
      'Owners retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};


// GET /api/v1/admin/admins
// Lists every Admin account for Super Admin management.
exports.getAllAdmins = async (
  req,
  res,
  next
) => {
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
      .sort({
        createdAt: -1,
      });

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


// GET /api/v1/admin/properties
// Return all properties for Admin/Super Admin listing review and management.
exports.getAllProperties = async (
  req,
  res,
  next
) => {
  try {
    // Fetch every Property regardless of its current lifecycle status.
    const properties =
      await Property.find()
        // Include the Owner's public account information.
        .populate(
          'owner',
          'fullName email'
        )
        // Include the assigned Agency information.
        .populate(
          'agency',
          'name status'
        )
        // Include the assigned Agent and that Agent's User account.
        .populate({
          path: 'agent',
          select:
            'user agency status',
          populate: {
            path: 'user',
            select:
              'fullName email',
          },
        })
        // Show the newest Properties first.
        .sort({
          createdAt: -1,
        });

    // Return the complete Admin Property collection.
    return api.success(
      res,
      { properties },
      'Admin properties retrieved successfully'
    );
  } catch (error) {
    // Pass unexpected database/server errors to the global error handler.
    next(error);
  }
};


// GET /api/v1/admin/system-settings
// Returns the global Luxora platform configuration.
exports.getSystemSettings = async (
  req,
  res,
  next
) => {
  try {
    /*
     * Find the single global SystemSettings document.
     */
    let settings =
      await SystemSettings.findOne({
        key: "global",
      });

    /*
     * Create the default configuration
     * automatically the first time it is requested.
     */
    if (!settings) {
      settings =
        await SystemSettings.create({
          key: "global",
          platformFee: 5,
          currency: "NGN",
          maintenanceMode: false,
          updatedBy: req.user._id,
        });
    }

    return api.success(
      res,
      { settings },
      "Global system settings retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};


// PATCH /api/v1/admin/system-settings
// Allows a Super Admin to update the global Luxora platform configuration.
exports.updateSystemSettings = async (
  req,
  res,
  next
) => {
  try {
    const {
      platformFee,
      currency,
      maintenanceMode,
    } = req.body;

    // Validate the platform fee when supplied.
    if (platformFee !== undefined) {
      if (
        typeof platformFee !== "number" ||
        Number.isNaN(platformFee) ||
        platformFee < 0 ||
        platformFee > 100
      ) {
        return next(
          new AppError(
            "Platform fee must be a number between 0 and 100",
            400
          )
        );
      }
    }

    // Validate the supported currencies.
    if (currency !== undefined) {
      if (
        !["NGN", "USD", "GBP"].includes(
          currency
        )
      ) {
        return next(
          new AppError(
            "Invalid system currency",
            400
          )
        );
      }
    }

    // Validate maintenance mode as a boolean.
    if (maintenanceMode !== undefined) {
      if (
        typeof maintenanceMode !==
        "boolean"
      ) {
        return next(
          new AppError(
            "maintenanceMode must be true or false",
            400
          )
        );
      }
    }

    // Build the update object from only supplied fields.
    const updates = {};

    if (platformFee !== undefined) {
      updates.platformFee = platformFee;
    }

    if (currency !== undefined) {
      updates.currency = currency;
    }

    if (maintenanceMode !== undefined) {
      updates.maintenanceMode =
        maintenanceMode;
    }

    // Prevent an empty update request.
    if (
      Object.keys(updates).length === 0
    ) {
      return next(
        new AppError(
          "At least one global setting is required",
          400
        )
      );
    }

    /*
     * Read the existing global settings before applying
     * the update so the audit log can record both the
     * previous and new configuration.
     */
    const existingSettings =
      await SystemSettings.findOne({
        key: "global",
      }).lean();

    const previousSettings = {
      platformFee:
        existingSettings?.platformFee ??
        null,

      currency:
        existingSettings?.currency ??
        null,

      maintenanceMode:
        existingSettings?.maintenanceMode ??
        null,
    };

    /*
     * Find the single global settings document.
     * Create it when it does not exist yet.
     */
   const settings =
  await SystemSettings.findOneAndUpdate(
    {
      key: "global",
    },
    {
      $set: {
        ...updates,
        updatedBy: req.user._id,
      },
      $setOnInsert: {
        key: "global",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
    /*
     * Record the real Admin action after the
     * System Settings update succeeds.
     *
     * The audit record contains both the previous
     * configuration and the resulting configuration.
     */
    await createAuditLog({
      req,

      action:
        "SYSTEM_SETTINGS_UPDATED",

      category:
        "System Settings",

      description:
        `${req.user.fullName} updated global platform system settings.`,

      targetType:
        "SystemSettings",

      targetId:
        settings._id,

      targetName:
        "Global Platform Settings",

      metadata: {
        before:
          previousSettings,

        after: {
          platformFee:
            settings.platformFee,

          currency:
            settings.currency,

          maintenanceMode:
            settings.maintenanceMode,
        },

        changedFields:
          Object.keys(updates),
      },
    });

    return api.success(
      res,
      { settings },
      "Global system settings updated successfully"
    );
  } catch (error) {
    next(error);
  }
};