const router = require('express').Router();
const agencyController = require('../controllers/agency.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { ROLES } = require('../config/constants');

// POST /api/v1/agencies
// protect          -> must be logged in
// restrictTo(ADMIN) -> must be an Admin (Super Admin gets in too automatically,
//                      via the bypass check already built into restrictTo)
router.post('/agencies', protect, restrictTo(ROLES.ADMIN), agencyController.createAgency);

module.exports = router;