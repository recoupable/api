const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Plain-English cadence for a cron schedule, for the schedule-confirmation
 * email (chat#1889).
 *
 * Deliberately narrow: it only describes the two shapes onboarding actually
 * creates (a fixed weekday time, and a fixed daily time). Anything else falls
 * back to the raw expression, because an honest cron string in an email beats a
 * confidently wrong sentence about when someone's report will arrive.
 *
 * @param schedule - Standard 5-field cron expression.
 * @param timeZone - IANA zone the expression is interpreted in; defaults to UTC.
 */
export function describeCronCadence(
  schedule: string,
  timeZone = "UTC",
): string {
  const fields = schedule.trim().split(/\s+/);
  const fallback = `the schedule ${schedule}`;
  if (fields.length !== 5) return fallback;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const minuteNum = Number(minute);
  const hourNum = Number(hour);

  const isFixedTime =
    /^\d{1,2}$/.test(minute) &&
    /^\d{1,2}$/.test(hour) &&
    minuteNum < 60 &&
    hourNum < 24;
  if (!isFixedTime || dayOfMonth !== "*" || month !== "*") return fallback;

  const at = `${pad(hourNum)}:${pad(minuteNum)} ${timeZone}`;

  if (dayOfWeek === "*") return `every day at ${at}`;

  if (/^[0-6]$/.test(dayOfWeek)) {
    return `${WEEKDAYS[Number(dayOfWeek)]} at ${at}`;
  }

  return fallback;
}
