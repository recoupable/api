import { escapeHtml } from "@/lib/emails/escapeHtml";
import { WELCOME_ONBOARDING_STEPS } from "@/lib/emails/welcome/welcomeOnboardingSteps";

/** Inline-style the step thumbnail by kind (overlap strip vs album cover vs IG). */
function imageTag(url: string, style: "wide" | "square" | "rounded", alt: string): string {
  const src = escapeHtml(url);
  const a = escapeHtml(alt);
  if (style === "wide") {
    // Overlapping-avatar strip (~3.9:1); fixed width, height auto keeps the ratio.
    return `<img src="${src}" width="132" alt="${a}" style="display:block;width:132px;height:auto;border:0"/>`;
  }
  const radius = style === "rounded" ? "12px" : "8px";
  return `<img src="${src}" width="56" height="56" alt="${a}" style="display:block;width:56px;height:56px;border-radius:${radius};object-fit:cover"/>`;
}

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
