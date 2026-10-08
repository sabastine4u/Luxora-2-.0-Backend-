const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const api = require("../utils/api-response");
const { ROLES } = require("../config/constants");
const {
  cloudinary,
  isCloudinaryConfigured,
} = require("../config/cloudinary");

// Import filesystem access so replaced profile pictures can be removed.
const fs = require("fs");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Security: public registration can ONLY create Buyer or Owner accounts.
    // We never trust a role submitted in the request body beyond that.
    const PUBLIC_ROLES = [ROLES.BUYER, ROLES.OWNER];

    if (role && !PUBLIC_ROLES.includes(role)) {
      return next(new AppError("Invalid role for public registration", 400));
    }

    const safeRole = PUBLIC_ROLES.includes(role) ? role : ROLES.BUYER;

    // Check if email already exists.
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return next(new AppError("Email already exists", 409));
    }

    // Create the user using the validated public role.
    const user = await User.create({
      fullName,
      email,
      password,
      role: safeRole,
    });

    // Prepare a safe response without sensitive fields.
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return api.created(
      res,
      {
        user: userResponse,
      },
      "User registered successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Include the password because it is excluded from normal queries.
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Compare the submitted password with the stored hash.
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Create the JWT for the authenticated user.
    const token = signToken(user._id);

     // Return the complete safe account information needed to rebuild the session after login.
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      department: user.department,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,

      // Return persisted dashboard settings so they survive logout and login.
      settings: user.settings || {},
    };

    return api.success(
      res,
      {
        token,
        user: userResponse,
      },
      "User logged in successfully",
    );
  } catch (error) {
    next(error);
  }
};

// Return the currently authenticated user's safe account information.
exports.getMe = async (req, res, next) => {
  try {
    // The protect middleware has already loaded the authenticated user.
    const userResponse = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      avatar: req.user.avatar,
      phone: req.user.phone,
      department: req.user.department,
      isVerified: req.user.isVerified,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,

      // Return persisted dashboard settings to the frontend session.
      settings: req.user.settings || {},
    };

    // Return the authenticated user.
    return api.success(
      res,
      {
        user: userResponse,
      },
      "Authenticated user retrieved successfully",
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Allows the authenticated user to update their own profile and dashboard settings.
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      settings,
    } = req.body;

    // Require at least one supported field.
    if (
      fullName === undefined &&
      email === undefined &&
      phone === undefined &&
      settings === undefined
    ) {
      return next(
        new AppError(
          "At least one profile or settings field is required",
          400,
        ),
      );
    }

    // Validate full name when supplied.
    if (
      fullName !== undefined &&
      (typeof fullName !== "string" || !fullName.trim())
    ) {
      return next(
        new AppError(
          "Full name must be a valid string",
          400,
        ),
      );
    }

    // Validate email when supplied.
    if (
      email !== undefined &&
      (typeof email !== "string" || !email.trim())
    ) {
      return next(
        new AppError(
          "Email must be a valid string",
          400,
        ),
      );
    }

    // Validate phone when supplied.
    if (
      phone !== undefined &&
      phone !== null &&
      typeof phone !== "string"
    ) {
      return next(
        new AppError(
          "Phone must be a valid string",
          400,
        ),
      );
    }

    // Normalize editable identity fields.
    const normalizedName =
      fullName !== undefined
        ? fullName.trim()
        : undefined;

    const normalizedEmail =
      email !== undefined
        ? email.trim().toLowerCase()
        : undefined;

    const normalizedPhone =
      phone !== undefined && phone !== null
        ? phone.trim()
        : phone;

    // Prevent duplicate email addresses.
    if (
      normalizedEmail &&
      normalizedEmail !== req.user.email
    ) {
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return next(
          new AppError(
            "Email already exists",
            409,
          ),
        );
      }
    }

    // Update supported profile fields only.
    if (normalizedName !== undefined) {
      req.user.fullName = normalizedName;
    }

    if (normalizedEmail !== undefined) {
      req.user.email = normalizedEmail;
    }

    if (phone !== undefined) {
      req.user.phone = normalizedPhone;
    }

     // Merge settings at both the top level and the individual dashboard sections.
    if (settings !== undefined) {
      const existingSettings =
        req.user.settings?.toObject?.() ||
        req.user.settings ||
        {};

      req.user.settings = {
        ...existingSettings,

        // Preserve existing Buyer preferences when only some Buyer fields change.
        buyer: {
          ...(existingSettings.buyer || {}),
          ...(settings.buyer || {}),
        },

        // Preserve existing Owner settings for the future Owner dashboard.
        owner: {
          ...(existingSettings.owner || {}),
          ...(settings.owner || {}),
        },

        // Preserve existing notification preferences when only some change.
        notifications: {
          ...(existingSettings.notifications || {}),
          ...(settings.notifications || {}),
        },

        // Preserve existing regional preferences when only some change.
        regional: {
          ...(existingSettings.regional || {}),
          ...(settings.regional || {}),
        },
      };
    }
    // Persist all profile changes.
    await req.user.save();

    // Return the updated safe user object.
    const userResponse = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      avatar: req.user.avatar,
      phone: req.user.phone,
      department: req.user.department,
      isVerified: req.user.isVerified,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,

      // Return the saved settings so the frontend immediately reflects the update.
      settings: req.user.settings || {},
    };

    // Return the updated profile.
    return api.success(
      res,
      {
        user: userResponse,
      },
      "Profile updated successfully",
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Handles uploading and saving the authenticated user's profile picture.
// Handles uploading and saving the authenticated user's profile picture.
exports.updateProfilePhoto = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.file) {
      return next(
        new AppError(
          "A profile picture is required",
          400,
        ),
      );
    }

    if (!isCloudinaryConfigured) {
      return next(
        new AppError(
          "Cloudinary is not configured. Add the Cloudinary environment variables.",
          500,
        ),
      );
    }

    // Upload the temporary Multer file to Cloudinary.
    const uploadResult =
      await cloudinary.uploader.upload(
        req.file.path,
        {
          folder:
            "luxora/users/avatars",
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
        },
      );

    // Store the permanent Cloudinary URL in MongoDB.
    req.user.avatar =
      uploadResult.secure_url;

    await req.user.save();

    // Remove the temporary local Multer file.
    try {
      await fs.unlink(
        req.file.path,
      );
    } catch {
      // Ignore cleanup failures.
    }

    const userResponse = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      avatar: req.user.avatar,
      phone: req.user.phone,
      department:
        req.user.department,
      isVerified:
        req.user.isVerified,
      isActive:
        req.user.isActive,
      createdAt:
        req.user.createdAt,
      updatedAt:
        req.user.updatedAt,
      settings:
        req.user.settings || {},
    };

    return api.success(
      res,
      {
        user: userResponse,
      },
      "Profile picture updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

// Logs the authenticated user out.
// JWT logout is ultimately handled by removing the token on the frontend.
exports.logout = (req, res) => {
  return api.success(res, {}, "Logged out successfully");
};

// Allows a logged-in user to change their password.
// The user must provide their current password before choosing a new one.
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Require both passwords before continuing.
    if (!currentPassword || !newPassword) {
      return next(
        new AppError(
          "Current password and new password are required",
          400,
        ),
      );
    }

    // Load the current user together with their password.
    const user = await User.findById(req.user.id).select("+password");

    // Verify the current password.
    const isPasswordCorrect = await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return next(new AppError("Current password is incorrect", 401));
    }

    // Replace the old password with the new one.
    // User model save middleware hashes it automatically.
    user.password = newPassword;

    // Save the updated password.
    await user.save();

    return api.success(
      res,
      {},
      "Password changed successfully",
    );
  } catch (error) {
    next(error);
  }
};