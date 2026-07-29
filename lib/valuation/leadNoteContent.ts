import type { ValuationLeadInput } from "@/lib/valuation/valuationLeadInput";
import { usd } from "@/lib/format/usd";

/**
 * Markdown body for one run's activity note — the chronology entry attached to
 * the Attio person on every valuation run. Lifetime streams and followers are
 * only listed when known.
 */
export function leadNoteContent(lead: ValuationLeadInput, today: string): string {
  const b = lead.valueBand;
  const signals: string[] = [];
  if (typeof lead.lifetimeStreams === "number")
    signals.push(`- Lifetime streams: ${lead.lifetimeStreams.toLocaleString("en-US")}`);
  if (typeof lead.followerCount === "number")
    signals.push(`- Followers: ${lead.followerCount.toLocaleString("en-US")}`);
  signals.push(`- Run date: ${today}`);

  return (
    `Valued [${lead.artistName}](https://open.spotify.com/artist/${lead.artistId}) at ` +
    `**${usd(b.central)}** (range ${usd(b.low)}–${usd(b.high)}).\n\n` +
    signals.join("\n")
  );
}
