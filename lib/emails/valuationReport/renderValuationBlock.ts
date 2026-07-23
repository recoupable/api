import { formatCompactUsd } from "@/lib/emails/valuationReport/formatCompactUsd";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Render the headline "Estimated catalog value" block (central value + range).
 * Returns "" when the catalog has no valuation so the section collapses.
 */
export function renderValuationBlock(valuation: ValuationReportEmailParams["valuation"]): string {
  if (!valuation) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px 24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Estimated catalog value</p>
<p style="margin:0;font-size:38px;line-height:1.1;letter-spacing:-0.02em;font-weight:700;color:#0a0a0a">${formatCompactUsd(valuation.mid)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#6b6b6b">Range ${formatCompactUsd(valuation.low)} to ${formatCompactUsd(valuation.high)}</p>
</td></tr></table>`;
}
