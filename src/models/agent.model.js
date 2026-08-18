const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    // =========================
    // PERSONAL DETAILS
    // =========================
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
    },

    residentialAddress: {
      type: String,
      trim: true,
    },

    // =========================
    // EMPLOYMENT
    // =========================
    employmentType: {
      type: String,
      trim: true,
    },

    yearsOfExperience: {
      type: Number,
      min: 0,
    },

    licenseNumber: {
      type: String,
      trim: true,
    },

    backgroundCheckStatus: {
      type: String,
      enum: ['Pending', 'Initiated', 'Cleared'],
      default: 'Pending',
    },

    // =========================
    // AGENCY ASSIGNMENT
    // =========================
    branch: {
      type: String,
      trim: true,
    },

    department: {
      type: String,
      trim: true,
    },

    level: {
      type: String,
      trim: true,
    },

    reportingManager: {
      type: String,
      trim: true,
    },

    // =========================
    // COVERAGE
    // =========================
    serviceStates: {
      type: [String],
      default: [],
    },

    neighborhoods: {
      type: [String],
      default: [],
    },

    coverageRadius: {
      type: String,
      trim: true,
    },

    // =========================
    // SPECIALIZATIONS
    // =========================
    specializations: {
      type: [String],
      default: [],
    },

    // =========================
    // COMMISSION
    // =========================
    commissionModel: {
      type: String,
      trim: true,
    },

    agentShare: {
      type: Number,
      min: 0,
      max: 100,
    },

    agencyShare: {
      type: Number,
      min: 0,
      max: 100,
    },

    signOnBonus: {
      type: Number,
      min: 0,
      default: 0,
    },

    // =========================
    // AUTHENTICATION
    // =========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // =========================
    // OWNERSHIP
    // =========================
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
    },

    // =========================
    // ACCOUNT STATUS
    // =========================
    status: {
      type: String,
      enum: ['Pending Verification', 'Active', 'Suspended'],
      default: 'Pending Verification',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Agent', agentSchema);