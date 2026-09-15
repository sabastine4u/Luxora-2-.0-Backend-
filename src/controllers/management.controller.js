const User = require("../models/user.model");
const { ROLES } = require("../config/constants");
const api = require("../utils/api-response");

/*
 * Manager Team Management
 *
 * This endpoint is intentionally different from:
 *
 * GET /admin/internal-staff
 *
 * Admin uses that endpoint for administrative account management.
 * Manager uses this endpoint for read-only operational workforce
 * oversight across the departments they supervise.
 */

const MANAGEMENT_TEAM_ROLES = [
  ROLES.PROCUREMENT,
  ROLES.FINANCE,
  ROLES.ANALYST,
  ROLES.PROPERTY_MANAGER,
  ROLES.SERVICE_ADMIN,
];

const MANAGEMENT_DEPARTMENTS = [
  "Finance",
  "Procurement",
  "Property Management",
  "Property Intelligence",
  "Home Services",
];

/*
 * GET /api/v1/management/team
 *
 * Optional query parameters:
 *
 * ?search=sarah
 * ?department=Finance
 * ?status=active
 *
 * These are read-only filters for the Manager's
 * personnel directory.
 */
exports.getManagementTeam = async (
  req,
  res,
  next,
) => {
  try {
    const {
      search,
      department,
      status,
    } = req.query;

    /*
     * Start with only the five operational
     * departments managed from the Manager dashboard.
     *
     * Exclude the current Manager account explicitly.
     */
    const filter = {
      role: {
        $in: MANAGEMENT_TEAM_ROLES,
      },

      _id: {
        $ne: req.user._id,
      },
    };

    /*
     * Department filter.
     */
    if (department) {
      if (
        !MANAGEMENT_DEPARTMENTS.includes(
          department,
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid management department.",
        });
      }

      filter.department =
        department;
    }

    /*
     * Active/inactive filter.
     */
    if (status) {
      const normalizedStatus =
        String(status).toLowerCase();

      if (
        normalizedStatus ===
        "active"
      ) {
        filter.isActive = true;
      } else if (
        normalizedStatus ===
        "inactive"
      ) {
        filter.isActive = false;
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Status must be active or inactive.",
        });
      }
    }

    /*
     * Search by name, email, or department.
     */
    if (search?.trim()) {
      const searchTerm =
        search.trim();

      filter.$or = [
        {
          fullName: {
            $regex:
              searchTerm,
            $options: "i",
          },
        },
        {
          email: {
            $regex:
              searchTerm,
            $options: "i",
          },
        },
        {
          department: {
            $regex:
              searchTerm,
            $options: "i",
          },
        },
      ];
    }

    const staff =
      await User.find(filter)
        .select(
          "_id fullName email phone role department isActive isVerified createdAt avatar",
        )
        .sort({
          department: 1,
          fullName: 1,
        })
        .lean();

    /*
     * Build real workforce counts from the
     * same result set returned by the filter.
     */
    const activeCount =
      staff.filter(
        (member) =>
          member.isActive,
      ).length;

    const inactiveCount =
      staff.length -
      activeCount;

    const verifiedCount =
      staff.filter(
        (member) =>
          member.isVerified,
      ).length;

    const unverifiedCount =
      staff.length -
      verifiedCount;

    /*
     * Department distribution is calculated
     * from actual User documents.
     */
    const departmentDistribution =
      MANAGEMENT_DEPARTMENTS.map(
        (departmentName) => {
          const members =
            staff.filter(
              (member) =>
                member.department ===
                departmentName,
            );

          const activeMembers =
            members.filter(
              (member) =>
                member.isActive,
            ).length;

          return {
            department:
              departmentName,

            total:
              members.length,

            active:
              activeMembers,

            inactive:
              members.length -
              activeMembers,
          };
        },
      );

    const formattedStaff =
      staff.map(
        (member) => ({
          id: member._id,
          name:
            member.fullName,
          email:
            member.email,
          phone:
            member.phone ||
            null,
          role:
            member.role,
          department:
            member.department ||
            null,
          status:
            member.isActive
              ? "Active"
              : "Inactive",
          isActive:
            member.isActive,
          isVerified:
            member.isVerified,
          avatar:
            member.avatar ||
            null,
          createdAt:
            member.createdAt,
        }),
      );

    return api.success(
      res,
      {
        team: formattedStaff,

        summary: {
          total:
            staff.length,

          active:
            activeCount,

          inactive:
            inactiveCount,

          verified:
            verifiedCount,

          unverified:
            unverifiedCount,
        },

        departments:
          departmentDistribution,

        filters: {
          departments:
            MANAGEMENT_DEPARTMENTS,
        },
      },
      "Management team retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};