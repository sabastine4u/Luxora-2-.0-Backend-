const User = require("../models/user.model");

const MANAGEMENT_ROLES = [
  "Procurement Officer",
  "Finance Manager",
  "Data Analyst",
  "Property Manager",
  "Service Manager",
];

/*
 * Department Oversight
 *
 * Departments are currently stored on User.department.
 * This service groups the Manager's operational staff
 * by their existing department values.
 */
const getDepartments = async () => {
  const staff = await User.find({
    role: {
      $in: MANAGEMENT_ROLES,
    },
  })
    .select(
      "_id fullName email phone role department isActive isVerified avatar createdAt",
    )
    .sort({
      department: 1,
      fullName: 1,
    })
    .lean();

  const departmentMap = new Map();

  staff.forEach((member) => {
    const department =
      member.department?.trim() ||
      "Unassigned";

    if (!departmentMap.has(department)) {
      departmentMap.set(department, {
        name: department,
        total: 0,
        active: 0,
        inactive: 0,
        roles: new Set(),
        members: [],
      });
    }

    const departmentData =
      departmentMap.get(department);

    departmentData.total += 1;

    if (member.isActive) {
      departmentData.active += 1;
    } else {
      departmentData.inactive += 1;
    }

    departmentData.roles.add(
      member.role,
    );

    departmentData.members.push({
      id: member._id,
      name: member.fullName,
      email: member.email,
      phone: member.phone || null,
      role: member.role,
      department,
      status: member.isActive
        ? "Active"
        : "Inactive",
      isActive: member.isActive,
      isVerified: member.isVerified,
      avatar: member.avatar || null,
      createdAt: member.createdAt,
    });
  });

  return Array.from(
    departmentMap.values(),
  )
    .map((department) => ({
      name: department.name,
      total: department.total,
      active: department.active,
      inactive: department.inactive,
      roles: Array.from(
        department.roles,
      ).sort(),
      members: department.members,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name),
    );
};

module.exports = {
  getDepartments,
};