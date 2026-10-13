const nodemailer = require("nodemailer");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const isEmailConfigured = Boolean(
  smtpHost &&
  smtpPort &&
  smtpUser &&
  smtpPass
);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure:
        process.env.SMTP_SECURE === "true" ||
        smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

async function sendMail({
  to,
  subject,
  html,
  text,
}) {
  if (!isEmailConfigured || !transporter) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    );
  }

  return transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_FROM ||
      smtpUser,
    to,
    subject,
    html,
    text,
  });
}

module.exports = {
  transporter,
  isEmailConfigured,
  sendMail,
};