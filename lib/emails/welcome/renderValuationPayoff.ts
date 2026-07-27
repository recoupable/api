import { escapeHtml } from "@/lib/emails/escapeHtml";

const COVER = "https://i.scdn.co/image/ab67616d00001e024aafdbad18bc27d7c429cdf1";

/**
 * The baseline valuation, framed as the payoff the four steps unlock rather than
 * a fifth chore (chat#1889). It sits after the numbered list, visually distinct,
 * and links to `/setup/valuation`.
 *
 * Why it is not a numbered step: the app derives exactly four checkpoints from
 * account state, and "has a valuation" is not derivable — `catalogs` persists no
 * valuation, the number is computed live from catalog measurements. Numbering it
 * gave the email a 5-step count the product could never agree with.
 *
 * @param baseUrl - Frontend base URL the link is built on.
 */
export function renderValuationPayoff(baseUrl: string): string {
  const href = escapeHtml(`${baseUrl}/setup/valuation`);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#fafafa;border:1px solid #e8e8e8;border-radius:12px">
<tr>
<td valign="middle" width="72" style="padding:16px 0 16px 16px"><img src="${COVER}" width="56" height="56" alt="Album cover" style="display:block;width:56px;height:56px;border-radius:8px"/></td>
<td valign="middle" style="padding:16px 16px 16px 12px">
<p style="margin:0 0 3px;font-size:15px;font-weight:700;color:#0a0a0a">Then: your baseline valuation</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b6b6b">What your catalog is worth today. It is the number every weekly report moves. <a href="${href}" style="color:#0a0a0a;font-weight:600;text-decoration:underline">See your baseline valuation.</a></p>
</td>
</tr>
</table>`;
}
