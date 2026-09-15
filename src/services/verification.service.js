// Import the Agent model because existing Agents may predate the Verification collection.
const Agent = require('../models/agent.model');

// Import the User model for the Agent's linked login/verification state.
const User = require('../models/user.model');

// Import the Verification model that stores the dedicated verification workflow.
const Verification = require('../models/verification.model');

// Import the application's controlled error class.
const AppError = require('../utils/AppError');

// Create Verification records for older Agents that are already waiting for verification.
const ensurePendingVerificationRecords = async () => {
  // Find Agents whose current account workflow says they are waiting for verification.
  const pendingAgents = await Agent.find({
    status: 'Pending Verification',
  })
    .select(
      '_id user agency fullName email createdAt'
    )
    .lean();

  // Stop immediately when there are no pending Agents.
  if (pendingAgents.length === 0) {
    return;
  }

  // Find Verification records that already belong to those pending Agents.
  const existingVerifications =
    await Verification.find({
      agent: {
        $in: pendingAgents.map(
          (agent) => agent._id
        ),
      },
    })
      .select('agent')
      .lean();

  // Build a quick lookup so we only create genuinely missing records.
  const existingAgentIds = new Set(
    existingVerifications.map(
      (verification) =>
        verification.agent.toString()
    )
  );

  // Create Verification records only for legacy pending Agents that do not have one yet.
  const missingRecords = pendingAgents
    .filter(
      (agent) =>
        !existingAgentIds.has(
          agent._id.toString()
        )
    )
    .map((agent) => ({
      agent: agent._id,
      user: agent.user,
      agency: agent.agency,
      status: 'Pending',
      verificationLevel: 'Unverified',
      history: [
        {
          action: 'Submitted',
          notes:
            'Verification record created for an existing pending Agent.',
          performedBy: null,
          performedAt:
            agent.createdAt || new Date(),
        },
      ],
    }));

  // Insert the missing records in one database operation.
  if (missingRecords.length > 0) {
    await Verification.insertMany(
      missingRecords
    );
  }
};

// Return the real Verification Center count.
exports.getVerificationCenterCount =
  async () => {
    // Ensure older pending Agents are represented in the Verification collection.
    await ensurePendingVerificationRecords();

    // Count only Verification records waiting for Admin review.
    return Verification.countDocuments({
      status: 'Pending',
    });
  };

  // Return real aggregate totals for the Verification Center dashboard.
exports.getVerificationCenterSummary = async () => {
  // Count Verification records grouped by their current overall status.
  const summary = await Verification.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Start every supported status at zero so the frontend always gets a stable response.
  const totals = {
    pending: 0,
    verified: 0,
    rejected: 0,
    revoked: 0,
  };

  // Copy the database counts into the named summary fields.
  summary.forEach((item) => {
    if (item._id === 'Pending') {
      totals.pending = item.count;
    }

    if (item._id === 'Verified') {
      totals.verified = item.count;
    }

    if (item._id === 'Rejected') {
      totals.rejected = item.count;
    }

    if (item._id === 'Revoked') {
      totals.revoked = item.count;
    }
  });

  // Return the complete Verification Center summary.
  return totals;
};

// Return Verification records for the selected Verification Center status.
exports.getVerificationCenterQueue = async (status = 'Pending') => {
  // Allow only the Verification states supported by the current workflow.
  const allowedStatuses = [
    'Pending',
    'Verified',
    'Rejected',
    'Revoked',
  ];

  // Fall back to Pending when an invalid status is supplied.
  const selectedStatus =
    allowedStatuses.includes(status)
      ? status
      : 'Pending';

  // Existing pending Agents are converted into Verification records before
  // the Pending tab is loaded, preserving the records already created.
  if (selectedStatus === 'Pending') {
    await ensurePendingVerificationRecords();
  }

  // Fetch Verification records for the requested Center tab.
  return Verification.find({
    status: selectedStatus,
  })
    .populate(
      'agent',
      'fullName email phone licenseNumber backgroundCheckStatus status createdAt'
    )
    .populate(
      'user',
      'fullName email isVerified verifiedAt'
    )
    .populate(
      'agency',
      'name status'
    )
    .populate(
      'reviewedBy',
      'fullName email'
    )
    .sort({
      createdAt: -1,
    });
};

// Return one Agent's complete verification record.
exports.getVerificationCenterDetails =
  async (agentId) => {
    // Ensure legacy pending records exist before looking up the requested Agent.
    await ensurePendingVerificationRecords();

    // Find the dedicated Verification record for this Agent.
    const verification =
      await Verification.findOne({
        agent: agentId,
      })
        .populate(
          'agent',
          'fullName email phone licenseNumber backgroundCheckStatus status createdAt'
        )
        .populate(
          'user',
          'fullName email isVerified verifiedAt'
        )
        .populate(
          'agency',
          'name status'
        )
        .populate(
          'reviewedBy',
          'fullName email'
        );

    // Return a controlled error when no Verification record exists.
    if (!verification) {
      throw new AppError(
        'Verification record not found',
        404
      );
    }

    // Return the fully populated Verification record.
    return verification;
  };

// Approve or reject an Agent verification request.
exports.reviewVerification =
  async ({
    agentId,
    reviewerId,
    decision,
    reviewNotes = '',
  }) => {
    // Ensure the requested decision is supported by the current workflow.
    if (
      !['Approved', 'Rejected'].includes(
        decision
      )
    ) {
      throw new AppError(
        'Decision must be Approved or Rejected',
        400
      );
    }

    // Require an explanation when rejecting an Agent.
    if (
      decision === 'Rejected' &&
      !reviewNotes.trim()
    ) {
      throw new AppError(
        'A rejection reason is required',
        400
      );
    }

    // Find the Agent being reviewed.
    const agent =
      await Agent.findById(agentId);

    // Stop when the Agent does not exist.
    if (!agent) {
      throw new AppError(
        'Agent not found',
        404
      );
    }

    // Find the User account attached to the Agent profile.
    const user =
      await User.findById(agent.user);

    // Stop when the linked User account does not exist.
    if (!user) {
      throw new AppError(
        'Agent user account not found',
        404
      );
    }

    // Ensure this Agent has a Verification record before reviewing it.
    await ensurePendingVerificationRecords();

    // Find the Agent's dedicated Verification record.
    const verification =
      await Verification.findOne({
        agent: agent._id,
      });

    // Stop when there is no Verification record to review.
    if (!verification) {
      throw new AppError(
        'Verification record not found',
        404
      );
    }

    // Only currently pending verification records can be approved or rejected.
    if (
      verification.status !==
      'Pending'
    ) {
      throw new AppError(
        `Verification is already ${verification.status.toLowerCase()}`,
        409
      );
    }

    // Use one timestamp for the entire review operation.
    const reviewTime = new Date();

    if (decision === 'Approved') {
      // Mark the verification record as approved.
      verification.status =
        'Verified';

      // Grant the first verification level supported by the current workflow.
      verification.verificationLevel =
        'Agent Reviewed';

      // Persist the Admin/Super Admin review notes.
      verification.reviewNotes =
        reviewNotes.trim() || null;

      // Clear any previous rejection reason.
      verification.rejectionReason =
        null;

      // Record who performed the review.
      verification.reviewedBy =
        reviewerId;

      // Record when the review occurred.
      verification.reviewedAt =
        reviewTime;

      // Record when the verification became successful.
      verification.verifiedAt =
        reviewTime;

      // Add the approval event to the audit history.
      verification.history.push({
        action: 'Approved',
        notes:
          reviewNotes.trim() || null,
        performedBy: reviewerId,
        performedAt: reviewTime,
      });

      // A successfully verified Agent becomes active.
      agent.status =
        'Active';

      // Grant the verified badge to the linked User account.
      user.isVerified = true;

      // Store the verification timestamp on the User.
      user.verifiedAt =
        reviewTime;
    } else {
      // Mark the verification as rejected.
      verification.status =
        'Rejected';

      // A rejected verification returns to the unverified level.
      verification.verificationLevel =
        'Unverified';

      // Store the reviewer's notes.
      verification.reviewNotes =
        reviewNotes.trim();

      // Store the same explanation as the rejection reason.
      verification.rejectionReason =
        reviewNotes.trim();

      // Record the reviewer.
      verification.reviewedBy =
        reviewerId;

      // Record the rejection time.
      verification.reviewedAt =
        reviewTime;

      // Ensure the rejected record is not marked as verified.
      verification.verifiedAt =
        null;

      // Keep the Agent in the verification workflow for future resubmission.
      agent.status =
        'Pending Verification';

      // Remove the verified badge from the linked User.
      user.isVerified = false;

      // Clear the previous verification timestamp.
      user.verifiedAt =
        null;

      // Add the rejection event to the audit history.
      verification.history.push({
        action: 'Rejected',
        notes:
          reviewNotes.trim(),
        performedBy: reviewerId,
        performedAt: reviewTime,
      });
    }

    // Save the dedicated Verification record.
    await verification.save();

    // Save the Agent workflow status.
    await agent.save();

    // Save the User verification state.
    await user.save();

    // Return all updated records to the controller.
    return {
      verification,
      agent,
      user,
    };
  };