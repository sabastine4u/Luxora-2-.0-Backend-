const router = require('express').Router();
const agentController = require('../controllers/agent.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { ROLES } = require('../config/constants');

// POST /api/v1/agents
// Only a logged-in Agency can create an Agent (Super Admin bypasses as always)
router.post('/agents', protect, restrictTo(ROLES.AGENCY), agentController.createAgent);
router.get('/agents', protect, restrictTo(ROLES.AGENCY), agentController.getAgents);
router.patch('/agents/:id/status', protect, restrictTo(ROLES.AGENCY), agentController.updateAgentStatus);

module.exports = router;