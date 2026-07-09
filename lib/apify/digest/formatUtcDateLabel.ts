const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic "Jul 8" date label (UTC — no locale/timezone variance). */
export function formatUtcDateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
