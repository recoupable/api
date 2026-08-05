import { formatCompactUsd } from "@/lib/emails/valuationReport/formatCompactUsd";
import type { CatalogValuationDelta } from "@/lib/catalog/getCatalogValuationDelta";

/**
 * The hero block prepended to a delta-led report email (chat#1911 row 5):
 * previous value, arrow, current value, signed percent change - or, for a
 * first measurement, the current band with the baseline note. Table-based
 * inline-style markup like the valuation report blocks, so it renders in
 * every mail client the layout already supports.
 */
export function renderValuationDeltaHero(delta: CatalogValuationDelta): string {
  const current = formatCompactUsd(delta.current.mid);

  if (delta.previous && delta.previous.mid > 0) {
    const previous = formatCompactUsd(delta.previous.mid);
    const pct = ((delta.current.mid - delta.previous.mid) / delta.previous.mid) * 100;
    const signed = `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)}%`;
    const color = pct >= 0 ? "#0a7d33" : "#b42318";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="padding:18px 20px;background:#fafafa;border-radius:10px">
<p style="margin:0;font-size:13px;color:#6b6b6b">Your catalog value</p>
<p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#0a0a0a">${previous} <span style="color:#6b6b6b;font-weight:400">&rarr;</span> ${current} <span style="font-size:15px;font-weight:700;color:${color}">${signed}</span></p>
<p style="margin:6px 0 0;font-size:13px;color:#6b6b6b">since your last measurement</p>
</td></tr></table>`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="padding:18px 20px;background:#fafafa;border-radius:10px">
<p style="margin:0;font-size:13px;color:#6b6b6b">Your catalog value</p>
<p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#0a0a0a">${current}</p>
<p style="margin:6px 0 0;font-size:13px;color:#6b6b6b">Your baseline is set. The next report shows the change.</p>
</td></tr></table>`;
}
