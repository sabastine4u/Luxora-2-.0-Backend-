const mongoose = require('mongoose');

// An Agency is its own entity, separate from the User account it logs in with -
// this document holds the agency's profile data, while a linked User document
// (role: 'Agency') handles authentication.
const agencySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },

    // The User account this Agency logs in with (role: 'Agency')
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Which Admin (or Super Admin) provisioned this Agency
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agency', agencySchema);