import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const FROM = process.env.EMAIL_FROM ?? "invii.ai <onboarding@resend.dev>";

export const emailEnabled = Boolean(resend);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent "${subject}" to ${to}`,
    );
    return { sent: false };
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false };
  }
}

function wrapper(title: string, bodyHtml: string): string {
  return `<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #4f6bff; font-weight: 600; margin: 0 0 16px;">invii.ai</p>
    <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
    ${bodyHtml}
  </div>`;
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: "Reset your invii.ai password",
    html: wrapper(
      "Reset your password",
      `<p style="font-size: 15px; line-height: 1.6; color: #444;">We got a request to reset the password for this account. This link expires in 1 hour.</p>
       <p style="margin: 24px 0;"><a href="${resetUrl}" style="background: #4f6bff; color: white; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; display: inline-block;">Reset password</a></p>
       <p style="font-size: 13px; color: #888;">If you didn&rsquo;t request this, you can safely ignore this email.</p>`,
    ),
  });
}

export function sendVerificationEmail(to: string, verifyUrl: string) {
  return sendEmail({
    to,
    subject: "Verify your email — invii.ai",
    html: wrapper(
      "Verify your email",
      `<p style="font-size: 15px; line-height: 1.6; color: #444;">Confirm this is your email address to finish setting up your invii.ai workspace.</p>
       <p style="margin: 24px 0;"><a href="${verifyUrl}" style="background: #4f6bff; color: white; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; display: inline-block;">Verify email</a></p>
       <p style="font-size: 13px; color: #888;">If you didn&rsquo;t create an invii.ai account, you can ignore this email.</p>`,
    ),
  });
}
