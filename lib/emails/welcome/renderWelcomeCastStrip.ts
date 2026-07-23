import { escapeHtml } from "@/lib/emails/escapeHtml";
import { WELCOME_EMAIL_CAST } from "@/lib/emails/welcome/welcomeEmailCast";

/**
 * Render the cast strip: a row of circular artist PFPs with names, showing the
 * kind of roster managers run on Recoup. Table + inline styles only, for email
 * client safety.
 */
export function renderWelcomeCastStrip(): string {
  const cells = WELCOME_EMAIL_CAST.map(artist => {
    const name = escapeHtml(artist.name);
    return `<td valign="top" align="center" style="padding:0 6px;width:20%">
<img src="${escapeHtml(artist.pfpUrl)}" width="52" height="52" alt="${name}" style="display:block;width:52px;height:52px;border-radius:50%;object-fit:cover;margin:0 auto 6px"/>
<p style="margin:0;font-size:11px;line-height:1.3;color:#6b6b6b">${name}</p>
</td>`;
  }).join("");

  return `<p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Managers run artists like these on Recoup</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr>${cells}</tr></table>`;
}
