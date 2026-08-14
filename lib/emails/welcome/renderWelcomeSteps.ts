import { escapeHtml } from "@/lib/emails/escapeHtml";
import { imageTag } from "@/lib/emails/welcome/imageTag";
import { WELCOME_ONBOARDING_STEPS } from "@/lib/emails/welcome/welcomeOnboardingSteps";

/**
 * Render the numbered onboarding steps. Each row is an art thumbnail beside the
 * step number, title, one-line description, and an inline link into the matching
 * `/setup/*` route (built from the frontend base URL). Table + inline styles
 * only, for email client safety.
 *
 * @param baseUrl - Frontend base URL the step links are built on.
 */
export function renderWelcomeSteps(baseUrl: string): string {
  const rows = WELCOME_ONBOARDING_STEPS.map((step, i) => {
    const href = escapeHtml(`${baseUrl}${step.linkPath}`);
    const link = `<a href="${href}" style="color:#0a0a0a;font-weight:600;text-decoration:underline">${escapeHtml(step.linkText)}</a>`;
    return `<tr>
<td valign="middle" width="148" style="padding:0 16px 20px 0">${imageTag(step.imageUrl, step.imageStyle, step.imageAlt)}</td>
<td valign="middle" style="padding:0 0 20px">
<p style="margin:0 0 3px;font-size:15px;font-weight:700;color:#0a0a0a">${i + 1}. ${escapeHtml(step.title)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b6b6b">${escapeHtml(step.description)} ${link}</p>
</td>
</tr>`;
  }).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${rows}</table>`;
}
