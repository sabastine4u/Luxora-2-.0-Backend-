const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { ROLES } = require("../config/constants");
const AppError = require("../utils/AppError");


// Auth middleware — protects routes by requiring a valid login.
// Final step: look up the actual user this token belongs to, and
// attach them to req.user so any controller after this can know
// exactly who is making the request.
exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided, access denied", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.id is the user's _id, since that's what we put inside
    // the token back in signToken() during login.
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(
        new AppError("User belonging to this token no longer exists", 401),
      );
    }
    // Attach the actual user document to the request. Every
    // controller running after this middleware can now read
    // req.user to know exactly who's making the call.
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }

    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired. Please log in again.", 401));
    }

    next(error);
  }
};

// protect must always run BEFORE this — restrictTo assumes req.user
// already exists, since it only checks WHAT a logged-in user can do,
// not WHETHER they're logged in at all.
exports.restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // Defensive check: if protect wasn't run first (maybe routing mistake), req.user would be undefined wouldnt not read
    // req.user.role below would crash the request. This turns that
    // mistake into a clean, understandable error instead.

    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    // Super Admin bypasses every restriction — matches the exact
    // same rule already built into the frontend's ProtectedRoute,
    // so both layers always agree on what Super Admin can do.
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }
    // Everyone else must have a role that's in the allowed list
    // passed in when this middleware was set up on the route.
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
