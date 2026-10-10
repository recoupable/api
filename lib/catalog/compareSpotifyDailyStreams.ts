import { z } from "zod";

const DAY_MS = 86_400_000;
const querySchema = z
  .object({ since: z.iso.date(), days: z.number().int().min(1).max(366) })
  .strict();

/**
 * Sum source-reported daily streams across two equal, complete UTC periods.
 * Caller must select one verified provider identity, scope and export version first.
 * Calendar completeness does not prove provider freshness or full catalog coverage.
 */
export function compareSpotifyDailyStreams(
  rows: { date: string; streams: number }[],
  query: { since: string; days: number },
  now: Date,
) {
  const parsed = querySchema.parse(query);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid comparison clock");
  const start = Date.parse(`${parsed.since}T00:00:00Z`) - parsed.days * DAY_MS;
  const dates = Array.from({ length: parsed.days * 2 }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
  const byDay = new Map<string, number>();
  let invalid = false;
  for (const row of rows) {
    if (!dates.includes(row.date)) continue;
    if (byDay.has(row.date) || !Number.isSafeInteger(row.streams) || row.streams < 0)
      invalid = true;
    byDay.set(row.date, row.streams);
  }
  const missingDays = dates.filter(date => !byDay.has(date));
  const sum = (period: string[]) =>
    period.reduce((total, date) => total + (byDay.get(date) ?? 0), 0);
  const previous = sum(dates.slice(0, parsed.days));
  const current = sum(dates.slice(parsed.days));
  invalid ||= !Number.isSafeInteger(previous) || !Number.isSafeInteger(current);
  const state = invalid
    ? "invalid_observation"
    : start + dates.length * DAY_MS > now.getTime()
      ? "unfinished_period"
      : missingDays.length
        ? "incomplete"
        : "comparable";
  return {
    state,
    missing_days: missingDays,
    previous_streams: state === "comparable" ? previous : null,
    current_streams: state === "comparable" ? current : null,
    absolute_growth: state === "comparable" ? current - previous : null,
    percentage_growth:
      state === "comparable" && previous > 0 ? ((current - previous) / previous) * 100 : null,
    zero_baseline: state === "comparable" && previous === 0,
  };
}
