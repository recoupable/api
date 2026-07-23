import { escapeHtml } from "@/lib/emails/escapeHtml";
import { WELCOME_ONBOARDING_STEPS } from "@/lib/emails/welcome/welcomeOnboardingSteps";

/**
 * Render the numbered onboarding steps: each row is an art thumbnail (artist
 * PFP or album cover) beside the step number, title, and one-line description.
 * Table + inline styles only, for email client safety.
 */
export function renderWelcomeSteps(): string {
  const rows = WELCOME_ONBOARDING_STEPS.map((step, i) => {
    const radius = step.thumbShape === "circle" ? "50%" : "8px";
    const alt = escapeHtml(step.thumbAlt);
    return `<tr>
<td valign="top" width="48" style="padding:0 14px 18px 0">
<img src="${escapeHtml(step.thumbUrl)}" width="48" height="48" alt="${alt}" style="display:block;width:48px;height:48px;border-radius:${radius};object-fit:cover"/>
</td>
<td valign="top" style="padding:0 0 18px">
<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#0a0a0a">${i + 1}. ${escapeHtml(step.title)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b6b6b">${escapeHtml(step.description)}</p>
</td>
</tr>`;
  }).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${rows}</table>`;
}
