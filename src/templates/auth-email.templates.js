// Luxora branded email templates.
// Used for email verification, welcome messages and sign-in alerts.

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const emailLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Luxora</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="background:#f3f4f6;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
          style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:#101a30;padding:28px 32px;text-align:center;">
              <div style="font-size:29px;font-weight:800;letter-spacing:2px;color:#d8b56d;">
                LUXORA
              </div>
              <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#ffffff;">
                REAL ESTATE, REIMAGINED
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <tr>
            <td style="background:#101a30;padding:24px 32px;text-align:center;">
              <div style="font-size:16px;font-weight:700;color:#d8b56d;">
                Luxora
              </div>
              <p style="margin:10px 0 0;font-size:12px;line-height:1.7;color:#d1d5db;">
                Your real estate marketplace for discovering and managing properties.
              </p>
              <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} Luxora. All rights reserved.
                <br />This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const verificationEmail = ({ fullName, code, expiresInMinutes = 5 }) => {
  const name = escapeHtml(fullName || "there");
  const safeCode = escapeHtml(code);
  const expires = Number(expiresInMinutes) || 5;

  const content = `
    <h1 style="margin:0 0 16px;font-size:25px;color:#101a30;">
      Verify your email address
    </h1>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      Hello ${name},
    </p>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      Welcome to Luxora! Please verify your email address to secure
      your account and complete your registration.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="margin:25px 0;background:#f8f5ed;border:1px solid #eadbb7;border-radius:10px;">
      <tr>
        <td style="padding:22px;text-align:center;">
          <div style="font-size:12px;letter-spacing:1px;color:#6b7280;">
            YOUR VERIFICATION CODE
          </div>
          <div style="margin:12px 0;font-size:34px;font-weight:800;letter-spacing:9px;color:#101a30;">
            ${safeCode}
          </div>
          <div style="font-size:13px;color:#6b7280;">
            Expires in ${expires} minutes
          </div>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;line-height:1.7;color:#6b7280;">
      If you did not create a Luxora account, you can safely ignore
      this email. Never share your verification code with anyone.
    </p>
  `;

  return {
    subject: "Verify your Luxora email address",
    html: emailLayout(content),
    text:
      `Hello ${fullName || "there"},\n\n` +
      `Welcome to Luxora. Your email verification code is: ${code}\n\n` +
      `This code expires in ${expires} minutes.\n\n` +
      "If you did not create this account, ignore this email.",
  };
};

const welcomeEmail = ({ fullName, role }) => {
  const name = escapeHtml(fullName || "there");
  const accountRole = escapeHtml(role || "Luxora member");

  const content = `
    <h1 style="margin:0 0 16px;font-size:25px;color:#101a30;">
      Welcome to Luxora
    </h1>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      Hello ${name},
    </p>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      Your Luxora account is now active. We're glad to have you
      with us as you discover and manage real estate opportunities.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="margin:24px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
      <tr>
        <td style="padding:18px;">
          <div style="font-size:12px;color:#6b7280;">ACCOUNT STATUS</div>
          <div style="margin:5px 0 14px;font-size:16px;font-weight:700;color:#15803d;">
            Active
          </div>

          <div style="font-size:12px;color:#6b7280;">ACCOUNT TYPE</div>
          <div style="margin-top:5px;font-size:15px;font-weight:700;color:#101a30;">
            ${accountRole}
          </div>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;line-height:1.7;color:#6b7280;">
      If you need help, please contact the Luxora support team.
    </p>
  `;

  return {
    subject: "Welcome to Luxora",
    html: emailLayout(content),
    text:
      `Hello ${fullName || "there"},\n\n` +
      "Your Luxora account is now active.\n" +
      `Account type: ${role || "Luxora member"}\n\n` +
      "Thank you for joining Luxora.",
  };
};

const newSignInEmail = ({ fullName, loginTime, device, ipAddress }) => {
  const name = escapeHtml(fullName || "there");
  const time = escapeHtml(loginTime || new Date().toLocaleString());
  const deviceName = escapeHtml(device || "Unknown device");
  const ip = escapeHtml(ipAddress || "Unavailable");

  const content = `
    <h1 style="margin:0 0 16px;font-size:25px;color:#101a30;">
      New sign-in detected
    </h1>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      Hello ${name},
    </p>

    <p style="font-size:15px;line-height:1.8;color:#4b5563;">
      A sign-in to your Luxora account was detected. If this was you,
      no action is required.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="margin:24px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;color:#6b7280;">
          Time
        </td>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#101a30;">
          ${time}
        </td>
      </tr>
      <tr>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;color:#6b7280;">
          Device
        </td>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#101a30;">
          ${deviceName}
        </td>
      </tr>
      <tr>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;color:#6b7280;">
          IP address
        </td>
        <td style="padding:13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#101a30;">
          ${ip}
        </td>
      </tr>
    </table>

    <div style="padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
      <p style="margin:0;font-size:13px;line-height:1.7;color:#9a3412;">
        If you did not sign in, your account may be compromised.
        Change your password immediately and contact Luxora support.
      </p>
    </div> 
  `;

  return {
    subject: "New sign-in to your Luxora account",
    html: emailLayout(content),
    text:
      `Hello ${fullName || "there"},\n\n` +
      "A sign-in to your Luxora account was detected.\n\n" +
      `Time: ${loginTime || new Date().toLocaleString()}\n` +
      `Device: ${device || "Unknown device"}\n` +
      `IP Address: ${ipAddress || "Unavailable"}\n\n` +
      "If this was not you, change your password and contact Luxora support.",
  };
};

module.exports = {
  verificationEmail,
  welcomeEmail,
  newSignInEmail,
};
