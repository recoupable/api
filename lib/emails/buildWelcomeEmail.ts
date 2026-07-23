import { CHAT_APP_URL, RECOUP_LOGO_URL, WEBSITE_URL } from "@/lib/const";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { renderWelcomeSteps } from "@/lib/emails/welcome/renderWelcomeSteps";

const FONT = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";

/**
 * Builds the welcome email sent to every new account. Instead of a generic
 * greeting, it walks the signup through Recoup's onboarding flow in five steps
 * (mirroring chat's onboarding sequence: confirm artists, verify socials, claim
 * catalog, see baseline valuation, automate with tasks), illustrated with art
 * from the house cast of artists (PFPs + album covers, stable Spotify CDN URLs).
 *
 * House style follows DESIGN.md / the valuation email: achromatic chrome
 * (#0a0a0a on #ffffff, #e8e8e8 borders, #6b6b6b muted), tables + inline styles
 * only, system font stack. Copy avoids em/en dashes.
 *
 * Deep links use the fixed `CHAT_APP_URL` (never a derived deployment URL, same
 * as the valuation email) so `/setup/*` always resolves to the real chat app,
 * including from preview test sends.
 *
 * @returns The email subject and HTML body.
 */
export function buildWelcomeEmail(): { subject: string; html: string } {
  const footer = getEmailFooter();

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e8;border-radius:16px">
<tr><td style="padding:32px 32px 28px;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
<td valign="top">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Welcome to Recoup</p>
<h1 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">You're in. Let's build your catalog value.</h1>
</td>
<td valign="top" align="right" width="44"><a href="${WEBSITE_URL}"><img src="${RECOUP_LOGO_URL}" width="36" height="36" alt="Recoup" style="display:block;width:36px;height:36px;border-radius:8px"/></a></td>
</tr></table>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#0a0a0a">Recoup is your AI team for the music business. Here is the five step path from a new account to a catalog you measure, grow, and automate.</p>
${renderWelcomeSteps(CHAT_APP_URL)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 8px"><tr><td style="background:#0a0a0a;border-radius:8px"><a href="${CHAT_APP_URL}/setup" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Confirm your roster &rarr;</a></td></tr></table>
${footer}
</td></tr></table>
</td></tr></table>`;

  return { subject: "Welcome to Recoup", html };
}
