import { isValidTimeZone } from "@/lib/tasks/timezone/isValidTimeZone";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the offset (localWallClock - UTC) in milliseconds that the given IANA
 * time zone applies at the given instant. DST-aware.
 */
function getTimeZoneOffsetMs(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock time in the given IANA time zone to the corresponding
 * UTC instant. DST-aware (refines once across offset boundaries).
 */
function zonedWallTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, monthIndex, day, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(timeZone, new Date(guess));
  let instant = guess - offset;
  const refinedOffset = getTimeZoneOffsetMs(timeZone, new Date(instant));
  if (refinedOffset !== offset) {
    instant = guess - refinedOffset;
  }
  return new Date(instant);
}

/**
 * Returns the local calendar date (year, monthIndex, day) that the given
 * instant falls on in the given time zone.
 */
function getLocalDateParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  monthIndex: number;
  day: number;
} {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    monthIndex: Number(map.month) - 1,
    day: Number(map.day),
  };
}

/**
 * Computes the next UTC instant at which a weekly/daily cron expression fires,
 * interpreting the cron's minute/hour/day-of-week in the given IANA time zone.
 *
 * This makes a "9am every Monday" schedule land at 9am *local* (DST-aware),
 * rather than 9am UTC. Supports the `M H * * D` shape used by weekly reports:
 * numeric minute and hour, `*` for day-of-month and month, and a numeric
 * day-of-week (0 or 7 = Sunday) or `*` for every day.
 *
 * @param cron - A 5-field cron expression (`minute hour dom mon dow`).
 * @param timeZone - The IANA time zone to interpret the cron in.
 * @param from - The instant to search forward from (exclusive).
 * @returns The next UTC Date the schedule fires at.
 * @throws If the time zone is invalid or the cron shape is unsupported.
 */
export function getNextUtcRunForLocalCron(cron: string, timeZone: string, from: Date): Date {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }

  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Unsupported cron expression (expected 5 fields): ${cron}`);
  }

  const [minuteField, hourField, domField, monField, dowField] = fields;

  if (domField !== "*" || monField !== "*") {
    throw new Error(`Unsupported cron expression (day-of-month and month must be "*"): ${cron}`);
  }

  const minute = Number(minuteField);
  const hour = Number(hourField);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Unsupported cron minute field: ${minuteField}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Unsupported cron hour field: ${hourField}`);
  }

  let targetDow: number | null = null;
  if (dowField !== "*") {
    const dow = Number(dowField);
    if (!Number.isInteger(dow) || dow < 0 || dow > 7) {
      throw new Error(`Unsupported cron day-of-week field: ${dowField}`);
    }
    targetDow = dow === 7 ? 0 : dow; // cron 0/7 = Sunday; JS getUTCDay 0 = Sunday
  }

  const base = getLocalDateParts(from, timeZone);
  const baseUtcMidnight = Date.UTC(base.year, base.monthIndex, base.day);

  // Search forward day-by-day (a matching weekday is at most 7 days out).
  for (let addDays = 0; addDays <= 8; addDays++) {
    const cal = new Date(baseUtcMidnight + addDays * DAY_MS);
    if (targetDow !== null && cal.getUTCDay() !== targetDow) {
      continue;
    }
    const candidate = zonedWallTimeToUtc(
      cal.getUTCFullYear(),
      cal.getUTCMonth(),
      cal.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }

  throw new Error(`Could not resolve a next run for cron "${cron}" in ${timeZone}`);
}
