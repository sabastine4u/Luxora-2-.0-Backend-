const departmentService = require("../services/department.service");

/*
 * GET /api/v1/departments
 *
 * Returns the departments and their current
 * operational workforce data.
 */
const getDepartments = async (req, res, next) => {
  try {
    const departments =
      await departmentService.getDepartments();

    return res.status(200).json({
      success: true,
      message:
        "Departments retrieved successfully",
      departments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
};