
const { sendMail } = require("../config/mail");

const {
  verificationEmail,
  welcomeEmail,
  newSignInEmail,
} = require("../templates/auth-email.templates");

// Send the email verification code to a newly registered Buyer or Owner.
const sendVerificationEmail = async (user, code) => {
  const email = verificationEmail({
    fullName: user.fullName,
    code,
    expiresInMinutes: 5,
  });

  return sendMail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
};

// Send the welcome email after successful email verification.
const sendWelcomeEmail = async (user) => {
  const email = welcomeEmail({
    fullName: user.fullName,
    role: user.role,
  });

  return sendMail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
};

// Alert the user about a first sign-in or a changed
// device, browser, or network location.
const sendNewSignInEmail = async (user, signInDetails) => {
  const email = newSignInEmail({
    fullName: user.fullName,
    loginTime: signInDetails.loginTime,
    device: signInDetails.device,
    ipAddress: signInDetails.ipAddress,
  });

  return sendMail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendNewSignInEmail,
};
