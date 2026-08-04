import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'LIPRO Academy <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = FROM_EMAIL;
  const subject = 'Reset your LIPRO Academy password';
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f7f7f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#0a0a0c;padding:28px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">LIPRO&nbsp;ACADEMY</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;color:#0a0a0c;">Reset your password</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
                We received a request to reset the password for your LIPRO Academy account.
                This link is valid for 30 minutes.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${resetUrl}" style="display:inline-block;background-color:#0a0a0c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#3b82f6;word-break:break-all;">${resetUrl}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f1f5f9;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} LIPRO Academy &middot; Your Life In Progress</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return resend.emails.send({ from, to, subject, html });
}

export { APP_URL };
