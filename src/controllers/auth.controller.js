
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");
const api = require("../utils/api-response");
const { ROLES } = require("../config/constants");
const {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendNewSignInEmail,
} = require("../services/email.service");
const {
  cloudinary,
  isCloudinaryConfigured,
} = require("../config/cloudinary");
const fs = require("fs");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const PUBLIC_REGISTRATION_ROLES = [
  ROLES.BUYER,
  ROLES.OWNER,
];

const normalizeEmail = (email) =>
  typeof email === "string"
    ? email.trim().toLowerCase()
    : "";

const generateVerificationCode = () =>
  String(crypto.randomInt(100000, 1000000));

// Generate a six-digit code and store only its bcrypt hash.
const prepareEmailVerification = async (user) => {
  const code = generateVerificationCode();

  user.emailVerified = false;
  user.emailVerificationCodeHash = await bcrypt.hash(
    code,
    10,
  );
  user.emailVerificationExpires = new Date(
    Date.now() + VERIFICATION_CODE_TTL_MS,
  );
  user.emailVerificationSentAt = new Date();
  user.emailVerificationAttempts = 0;

  return code;
};

// Email-delivery failure must not invalidate a successful
// account operation or prevent a valid user from signing in.
const sendEmailWithoutBlocking = async (label, callback) => {
  try {
    await callback();
    return true;
  } catch (error) {
    console.error(
      `[Luxora email] ${label} failed:`,
      error.message,
    );

    return false;
  }
};

// Return only safe account fields to the frontend.
const safeUserResponse = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  department: user.department,
  isVerified: user.isVerified,
  emailVerified: user.emailVerified !== false,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  settings: user.settings || {},
});

// ======================================================
// REGISTER
// Public registration is allowed only for Buyer and Owner.
// ======================================================

exports.register = async (req, res, next) => {
  try {
    const { fullName, password, role } = req.body || {};
    const email = normalizeEmail(req.body?.email);

    if (
      role &&
      !PUBLIC_REGISTRATION_ROLES.includes(role)
    ) {
      return next(
        new AppError(
          "Invalid role for public registration",
          400,
        ),
      );
    }

    if (
      !fullName ||
      typeof fullName !== "string" ||
      !fullName.trim()
    ) {
      return next(
        new AppError("Full name is required", 400),
      );
    }

    if (!email) {
      return next(
        new AppError(
          "A valid email address is required",
          400,
        ),
      );
    }

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return next(
        new AppError(
          "Password must be at least 8 characters long",
          400,
        ),
      );
    }

    // A missing role defaults to Buyer.
    // No other role can be selected through public registration.
    const safeRole = PUBLIC_REGISTRATION_ROLES.includes(role)
      ? role
      : ROLES.BUYER;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return next(
        new AppError("Email already exists", 409),
      );
    }

    // Explicitly mark self-registered accounts unverified.
    // Password hashing is handled by the User model middleware.
    const user = new User({
      fullName: fullName.trim(),
      email,
      password,
      role: safeRole,
      emailVerified: false,
    });

    const verificationCode =
      await prepareEmailVerification(user);

    await user.save();

    const verificationEmailSent =
      await sendEmailWithoutBlocking(
        "registration verification email",
        () => sendVerificationEmail(user, verificationCode),
      );

    if (!verificationEmailSent) {
      // Permit an immediate retry if SMTP delivery failed.
      user.emailVerificationCodeHash = null;
      user.emailVerificationExpires = null;
      user.emailVerificationSentAt = null;
      user.emailVerificationAttempts = 0;

      await user.save();
    }

    return api.created(
      res,
      {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: false,
        },
        emailVerificationRequired: true,
        verificationEmailSent,
      },
      verificationEmailSent
        ? "Account created. Check your email for the verification code."
        : "Account created, but the verification email could not be sent. Please request another code.",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// LOGIN
// Send a security alert on first sign-in or when the
// recorded device or IP address changes.
// ======================================================

exports.login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};

    if (!email || typeof password !== "string" || !password) {
      return next(
        new AppError(
          "Email and password are required",
          400,
        ),
      );
    }

    // Explicitly retrieve the password hash and the previous
    // sign-in context because these fields are hidden by default.
    const user = await User.findOne({ email }).select(
      "+password +lastLoginDevice +lastLoginIp",
    );

    if (!user) {
      return next(
        new AppError("Invalid email or password", 401),
      );
    }

    const isPasswordValid =
      await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(
        new AppError("Invalid email or password", 401),
      );
    }

    if (!user.isActive) {
      return next(
        new AppError(
          "This account is inactive. Please contact support.",
          403,
        ),
      );
    }

    // New self-registered accounts must verify their email.
    // Accounts not explicitly marked unverified remain compatible.
    if (user.emailVerified === false) {
      return next(
        new AppError(
          "Please verify your email address before signing in. You can request a new verification code if needed.",
          403,
        ),
      );
    }

    const loginAt = new Date();

    const device = String(
      req.get("user-agent") || "Unknown device",
    ).slice(0, 500);

    const ipAddress = String(
      req.ip ||
        req.socket?.remoteAddress ||
        "Unavailable",
    ).slice(0, 100);

    const isFirstSignIn = !user.lastLoginAt;

    const isNewDevice = Boolean(
      user.lastLoginAt &&
      user.lastLoginDevice !== device,
    );

    const isNewIpAddress = Boolean(
      user.lastLoginAt &&
      user.lastLoginIp !== ipAddress,
    );

    const shouldSendSignInAlert =
      isFirstSignIn ||
      isNewDevice ||
      isNewIpAddress;

    // Save the successful login context first.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: loginAt,
          lastLoginDevice: device,
          lastLoginIp: ipAddress,
        },
      },
    );

    if (shouldSendSignInAlert) {
      await sendEmailWithoutBlocking(
        "new sign-in alert",
        () =>
          sendNewSignInEmail(user, {
            loginTime: loginAt.toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            }),
            device,
            ipAddress,
          }),
      );
    }

    const token = signToken(user._id);

    return api.success(
      res,
      {
        token,
        user: safeUserResponse({
          ...user.toObject(),
          emailVerified: user.emailVerified,
          lastLoginAt: loginAt,
          lastLoginDevice: device,
          lastLoginIp: ipAddress,
        }),
      },
      "User logged in successfully",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// VERIFY EMAIL
// Accept a valid, unexpired six-digit verification code.
// ======================================================

exports.verifyEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email || !/^\d{6}$/.test(code)) {
      return next(
        new AppError(
          "A valid email address and six-digit code are required",
          400,
        ),
      );
    }

    const user = await User.findOne({ email }).select(
      "+emailVerificationCodeHash " +
      "+emailVerificationExpires " +
      "+emailVerificationSentAt " +
      "+emailVerificationAttempts",
    );

    if (!user) {
      return next(
        new AppError(
          "Invalid email or verification code",
          400,
        ),
      );
    }

    if (user.emailVerified !== false) {
      return api.success(
        res,
        { emailVerified: true },
        "Email address is already verified",
      );
    }

    if (
      (user.emailVerificationAttempts || 0) >=
      MAX_VERIFICATION_ATTEMPTS
    ) {
      return next(
        new AppError(
          "Too many incorrect verification attempts. Request a new code.",
          429,
        ),
      );
    }

    const expiresAt = user.emailVerificationExpires
      ? new Date(user.emailVerificationExpires).getTime()
      : 0;

    if (
      !user.emailVerificationCodeHash ||
      !expiresAt ||
      expiresAt <= Date.now()
    ) {
      user.emailVerificationCodeHash = null;
      user.emailVerificationExpires = null;
      user.emailVerificationSentAt = null;
      user.emailVerificationAttempts = 0;

      await user.save();

      return next(
        new AppError(
          "The verification code has expired. Request a new code.",
          400,
        ),
      );
    }

    const codeIsValid = await bcrypt.compare(
      code,
      user.emailVerificationCodeHash,
    );

    if (!codeIsValid) {
      user.emailVerificationAttempts =
        (user.emailVerificationAttempts || 0) + 1;

      if (
        user.emailVerificationAttempts >=
        MAX_VERIFICATION_ATTEMPTS
      ) {
        user.emailVerificationCodeHash = null;
        user.emailVerificationExpires = null;
        user.emailVerificationSentAt = null;
      }

      await user.save();

      const attemptsExceeded =
        user.emailVerificationAttempts >=
        MAX_VERIFICATION_ATTEMPTS;

      return next(
        new AppError(
          attemptsExceeded
            ? "Too many incorrect verification attempts. Request a new code."
            : "Invalid email or verification code",
          attemptsExceeded ? 429 : 400,
        ),
      );
    }

    // Verification succeeded. Clear the temporary code immediately.
    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpires = null;
    user.emailVerificationSentAt = null;
    user.emailVerificationAttempts = 0;

    await user.save();

    const welcomeEmailSent =
      await sendEmailWithoutBlocking(
        "welcome email",
        () => sendWelcomeEmail(user),
      );

    return api.success(
      res,
      {
        emailVerified: true,
        welcomeEmailSent,
      },
      welcomeEmailSent
        ? "Email verified successfully. Welcome to Luxora."
        : "Email verified successfully, but the welcome email could not be sent.",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// RESEND VERIFICATION CODE
// A one-minute cooldown helps prevent email abuse.
// ======================================================

exports.resendVerification = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return next(
        new AppError(
          "A valid email address is required",
          400,
        ),
      );
    }

    // Return the same response whether the account exists or not.
    const genericMessage =
      "If this email belongs to an unverified Luxora account, a verification code will be sent.";

    const user = await User.findOne({ email }).select(
      "+emailVerificationCodeHash " +
      "+emailVerificationExpires " +
      "+emailVerificationSentAt " +
      "+emailVerificationAttempts",
    );

    if (!user || user.emailVerified !== false) {
      return api.success(
        res,
        {},
        genericMessage,
      );
    }

    const lastSentAt = user.emailVerificationSentAt
      ? new Date(user.emailVerificationSentAt).getTime()
      : 0;

    if (
      lastSentAt &&
      Date.now() - lastSentAt <
        VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      return api.success(
        res,
        {},
        genericMessage,
      );
    }

    const verificationCode =
      await prepareEmailVerification(user);

    await user.save();

    const emailSent = await sendEmailWithoutBlocking(
      "resend verification email",
      () => sendVerificationEmail(user, verificationCode),
    );

    if (!emailSent) {
      // Let the user retry if the email provider fails.
      user.emailVerificationCodeHash = null;
      user.emailVerificationExpires = null;
      user.emailVerificationSentAt = null;
      user.emailVerificationAttempts = 0;

      await user.save();
    }

    return api.success(
      res,
      {},
      genericMessage,
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET CURRENT USER
// ======================================================

exports.getMe = async (req, res, next) => {
  try {
    const userResponse = safeUserResponse(req.user);

    return api.success(
      res,
      { user: userResponse },
      "Authenticated user retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE PROFILE AND DASHBOARD SETTINGS
// ======================================================

exports.updateProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      settings,
    } = req.body;

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

    if (
      fullName !== undefined &&
      (
        typeof fullName !== "string" ||
        !fullName.trim()
      )
    ) {
      return next(
        new AppError(
          "Full name must be a valid string",
          400,
        ),
      );
    }

    if (
      email !== undefined &&
      (
        typeof email !== "string" ||
        !email.trim()
      )
    ) {
      return next(
        new AppError(
          "Email must be a valid string",
          400,
        ),
      );
    }

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

    const emailChanged =
      normalizedEmail !== undefined &&
      normalizedEmail !== req.user.email;

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
          new AppError("Email already exists", 409),
        );
      }
    }

    if (normalizedName !== undefined) {
      req.user.fullName = normalizedName;
    }

    let newEmailVerificationCode = null;

    if (normalizedEmail !== undefined) {
      req.user.email = normalizedEmail;

      // A changed email address must be verified before
      // the next sign-in.
      if (emailChanged) {
        newEmailVerificationCode =
          await prepareEmailVerification(req.user);
      }
    }

    if (phone !== undefined) {
      req.user.phone = normalizedPhone;
    }

    // Merge settings without erasing existing preferences.
    if (settings !== undefined) {
      const existingSettings =
        req.user.settings?.toObject?.() ||
        req.user.settings ||
        {};

      req.user.settings = {
        ...existingSettings,

        buyer: {
          ...(existingSettings.buyer || {}),
          ...(settings.buyer || {}),
        },

        owner: {
          ...(existingSettings.owner || {}),
          ...(settings.owner || {}),
        },

        notifications: {
          ...(existingSettings.notifications || {}),
          ...(settings.notifications || {}),
        },

        regional: {
          ...(existingSettings.regional || {}),
          ...(settings.regional || {}),
        },
      };
    }

    await req.user.save();

    let verificationEmailSent;

    if (emailChanged) {
      verificationEmailSent =
        await sendEmailWithoutBlocking(
          "updated-email verification email",
          () =>
            sendVerificationEmail(
              req.user,
              newEmailVerificationCode,
            ),
        );

      if (!verificationEmailSent) {
        req.user.emailVerificationCodeHash = null;
        req.user.emailVerificationExpires = null;
        req.user.emailVerificationSentAt = null;
        req.user.emailVerificationAttempts = 0;

        await req.user.save();
      }
    }

    const userResponse = safeUserResponse(req.user);

    return api.success(
      res,
      {
        user: userResponse,
        ...(emailChanged
          ? {
              emailVerificationRequired: true,
              verificationEmailSent,
            }
          : {}),
      },
      emailChanged
        ? verificationEmailSent
          ? "Profile updated. Verify your new email address before signing in again."
          : "Profile updated, but the verification email could not be sent. Request a new code later."
        : "Profile updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE PROFILE PHOTO THROUGH CLOUDINARY
// ======================================================

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

    const uploadResult =
      await cloudinary.uploader.upload(
        req.file.path,
        {
          folder: "luxora/users/avatars",
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
        },
      );

    req.user.avatar = uploadResult.secure_url;

    await req.user.save();

    // Remove the temporary local Multer file.
    try {
      await fs.unlink(req.file.path);
    } catch {
      // Ignore cleanup failures.
    }

    return api.success(
      res,
      {
        user: safeUserResponse(req.user),
      },
      "Profile picture updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// LOGOUT
// JWT logout is handled on the frontend by removing the token.
// ======================================================

exports.logout = (req, res) => {
  return api.success(
    res,
    {},
    "Logged out successfully",
  );
};

// ======================================================
// CHANGE PASSWORD
// ======================================================

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(
        new AppError(
          "Current password and new password are required",
          400,
        ),
      );
    }

    const user = await User.findById(req.user.id).select(
      "+password",
    );

    if (!user) {
      return next(
        new AppError("User account was not found", 404),
      );
    }

    const isPasswordCorrect =
      await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return next(
        new AppError(
          "Current password is incorrect",
          401,
        ),
      );
    }

    // The User model hashes the password when saved.
    user.password = newPassword;
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
