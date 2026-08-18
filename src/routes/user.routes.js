const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { ROLES } = require('../config/constants');

// Only a logged-in Super Admin can create Admin accounts.
// protect: must be logged in at all.
// restrictTo: must specifically hold the Super Admin role.
router.post('/admin', protect, restrictTo(ROLES.SUPER_ADMIN), userController.createAdmin);

///Now the Superadmin and the admin can both create these internal staff roles 
router.post('/internal-staff', protect, restrictTo(ROLES.ADMIN), userController.createInternalStaff);

module.exports = router;

