import { parseCronField } from "@/lib/plans/parseCronField";

/** Fires to sample; enough to see the tightest gap of any realistic schedule. */
const MAX_FIRES = 50;
/** How far to scan: long enough that a yearly cron fires twice. */
const WINDOW_MINUTES = 400 * 24 * 60;
/** A fixed Thursday so results never depend on when the check runs. */
const EPOCH = Date.UTC(2026, 0, 1, 0, 0);

/**
 * The shortest gap, in minutes, between two consecutive runs of a 5-field
 * cron expression, found by walking the calendar minute by minute from a
 * fixed epoch. Day-of-month and day-of-week combine the standard way (either
 * matches when both are restricted). Returns null when the expression does
 * not parse; a cron that fires fewer than twice in 400 days returns the
 * window length, which no plan floor exceeds.
 */
export function getMinCadenceMinutes(cron: string): number | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minutes = parseCronField(fields[0], 0, 59);
  const hours = parseCronField(fields[1], 0, 23);
  const days = parseCronField(fields[2], 1, 31);
  const months = parseCronField(fields[3], 1, 12);
  const weekdays = parseCronField(fields[4], 0, 7);
  if (!minutes || !hours || !days || !months || !weekdays) return null;
  if (weekdays.has(7)) weekdays.add(0);
  const dayRestricted = fields[2] !== "*";
  const weekdayRestricted = fields[4] !== "*";

  let previous: number | null = null;
  let minGap = WINDOW_MINUTES;
  let fires = 0;
  for (let m = 0; m < WINDOW_MINUTES && fires < MAX_FIRES; m += 1) {
    const at = new Date(EPOCH + m * 60_000);
    if (!minutes.has(at.getUTCMinutes()) || !hours.has(at.getUTCHours())) continue;
    if (!months.has(at.getUTCMonth() + 1)) continue;
    const dayMatch = days.has(at.getUTCDate());
    const weekdayMatch = weekdays.has(at.getUTCDay());
    const dateMatch =
      dayRestricted && weekdayRestricted ? dayMatch || weekdayMatch : dayMatch && weekdayMatch;
    if (!dateMatch) continue;
    if (previous !== null) minGap = Math.min(minGap, m - previous);
    previous = m;
    fires += 1;
  }
  return minGap;
}
