const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const api = require("../utils/api-response");
const { ROLES } = require("../config/constants");


const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Security: public registration can ONLY create Buyer or Owner accounts.
    // We never trust a role submitted in the request body beyond that -
    // anything else (Admin, Super Admin, Agent, etc.) gets rejected outright,
    // no matter what the frontend sends. Those roles are created through
    // separate, controlled provisioning endpoints later, not public signup.
    const PUBLIC_ROLES = [ROLES.BUYER, ROLES.OWNER];
    if (role && !PUBLIC_ROLES.includes(role)) {
      return next(new AppError("Invalid role for public registration", 400));
    }
    const safeRole = PUBLIC_ROLES.includes(role) ? role : ROLES.BUYER;

    // Check if email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return next(new AppError("Email already exists", 409));
    }

    // Create the user - using safeRole, never the raw request body value
    const user = await User.create({
      fullName,
      email,
      password,
      role: safeRole,
    });

    // Prepare safe response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return api.created( res,
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

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return next(new AppError("Invalid email or password", 401));
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(new AppError("Invalid email or password", 401));
    }

    const token = signToken(user._id);

    // Prepare safe response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return api.success( res,
  {
    token,
    user: userResponse,
  },
  "User logged in successfully"
);
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const userResponse = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department,
      isVerified: req.user.isVerified,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };

    return api.success(res,
  {
    user: userResponse,
  },
  "Profile retrieved successfully"
);
  } catch (error) {
    next(error);
  }
};

// Logs the user out.
//
// Since JWT authentication is stateless, the backend does not store
// the token and therefore cannot "delete" it. Logout simply tells
// the frontend the request was successful so it can remove the token
// from storage and redirect the user to the login page..
exports.logout = (req, res) => {
  return api.success(res, {}, "Logged out successfully");
};

// Allows a logged-in user to change their password.
// The user must provide their current password before
// choosing a new one.// Allows a logged-in user to change their password.
// The user must provide their current password before
// choosing a new one...
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    //If someone sends: json {} api will now return a cear message 
if (!currentPassword || !newPassword) {
  return next(
    new AppError("Current password and new password are required", 400)
  );
}
    // Load the current user together with their password.
    // Password is excluded by default (select: false), so
    // we explicitly include it here.
    const user = await User.findById(req.user.id).select("+password");


    // Verify that the current password provided matches the
    // user's existing password stored in the database.
    const isPasswordCorrect = await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return next(new AppError("Current password is incorrect", 401));
    }

    // Replace the old password with the new one.
    // The pre("save") middleware in the User model
    // will automatically hash it before saving.
    user.password = newPassword;

    // Save the updated user.
    // This triggers the password hashing middleware.
    await user.save();

    return api.success(
      res,
      {},
      "Password changed successfully"
    );
  } catch (error) {
    next(error);
  }
};  
