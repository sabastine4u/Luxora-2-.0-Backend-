const mongoose = require('mongoose');
require('dotenv').config();

// This is the One-time script to create the platform's first Super Admin account.
// And we un manually from the terminal - never exposed through the public API,
// since Super Admin must never be self-registerable.

const connectDB = require('../config/database');
const User = require('../models/user.model');
const { ROLES } = require('../config/constants');

const SUPER_ADMIN_EMAIL = 'superadmin@luxora.com';
const SUPER_ADMIN_PASSWORD = 'ChangeThisPassword123'; // We will change this password

const seedSuperAdmin = async () => {
  await connectDB();

  // Don't create a duplicate if one already exists
  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log('Super Admin already exists:', SUPER_ADMIN_EMAIL);
    process.exit(0);
  }

  // Note: we pass the plain password here - the User model's pre('save') hook
  // (the same one that hashes passwords on register) handles hashing automatically.
  await User.create({
    fullName: 'Luxora Super Admin',
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    role: ROLES.SUPER_ADMIN,
  });

  console.log('Super Admin created successfully:');
  console.log('  Email:', SUPER_ADMIN_EMAIL);
  console.log('  Password:', SUPER_ADMIN_PASSWORD);
  console.log('  (change this password after first login)');

  process.exit(0);
};

seedSuperAdmin().catch((err) => {
  console.error('Failed to seed Super Admin:', err);
  process.exit(1);
});