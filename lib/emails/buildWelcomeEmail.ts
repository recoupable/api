import { CHAT_APP_URL } from "@/lib/const";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";
import { renderWelcomeSteps } from "@/lib/emails/welcome/renderWelcomeSteps";

/**
 * Builds the welcome email sent to every new account. Instead of a generic
 * greeting, it walks the signup through Recoup's onboarding flow in five steps
 * (mirroring chat's onboarding sequence: confirm artists, verify socials, claim
 * catalog, see baseline valuation, automate with tasks), illustrated with art
 * from the house cast of artists (PFPs + album covers, stable Spotify CDN URLs).
 *
 * Chrome comes from the shared `renderEmailLayout` wrapper (consistency pass,
 * chat#1885) — the same header / card / CTA / footer the valuation and
 * weekly-report emails use — so this builder only owns its body content, CTA
 * target, and footer. Copy avoids em/en dashes.
 *
 * Deep links use the fixed `CHAT_APP_URL` (never a derived deployment URL, same
 * as the valuation email) so `/setup/*` always resolves to the real chat app,
 * including from preview test sends.
 *
 * @returns The email subject and HTML body.
 */
export function buildWelcomeEmail(): { subject: string; html: string } {
  const footer = getEmailFooter();

  const bodyHtml = `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Welcome to Recoup</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">You're in. Let's build your catalog value.</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#0a0a0a">Recoup is your AI team for the music business. Here is the five step path from a new account to a catalog you measure, grow, and automate.</p>
${renderWelcomeSteps(CHAT_APP_URL)}`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: { label: "Confirm your roster &rarr;", url: `${CHAT_APP_URL}/setup` },
    footerHtml: footer,
  });

  return { subject: "Welcome to Recoup", html };
}
