import { getFrontendBaseUrl } from "@/lib/composio/getFrontendBaseUrl";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";

/**
 * Builds the welcome email sent to every new account: a short greeting and
 * one next step (see your catalog valuation on the chat app), styled to match
 * the existing plain inline-HTML email templates.
 *
 * @returns The email subject and HTML body.
 */
export function buildWelcomeEmail(): { subject: string; html: string } {
  const chatUrl = getFrontendBaseUrl();
  const footer = getEmailFooter();

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
  <h1 style="font-size:20px;margin:0 0 16px;">Welcome to Recoup</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
    Recoup is your AI team for the music business. Ask about your artists,
    your catalog, or your next release, and it does the work.
  </p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
    Your next step: see what your catalog is worth.
  </p>
  <p style="margin:0 0 24px;">
    <a href="${chatUrl}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;">
      See your valuation
    </a>
  </p>
  ${footer}
</div>`.trim();

  return { subject: "Welcome to Recoup", html };
}
