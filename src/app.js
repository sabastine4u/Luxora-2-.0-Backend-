const express = require('express');
const authRoutes = require('./routes/auth.routes');
const app = express();
const globalErrorHandler = require('./middleware/error.middleware');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');// Handles Super-Admin-only account provisioning (currently: create Admin accounts)
const agencyRoutes = require('./routes/agency.routes');
const agentRoutes = require('./routes/agent.routes');  
const adminRoutes = require('./routes/admin.routes');


// Allow the frontend (Vite dev server) to talk to this backend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
// Middleware to parse JSON requests
app.use(express.json());

// Define a simple route for the root URL
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Luxora Backend',
  });
});


app.use('/api/v1/auth', authRoutes);
// User/account provisioning: currently just POST /api/v1/users/admin,
// restricted to Super Admin only (see user.routes.js)
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', agencyRoutes);
app.use('/api/v1', agentRoutes);
app.use('/api/v1', adminRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;