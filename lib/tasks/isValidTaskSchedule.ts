import { CronExpressionParser } from "cron-parser";

const SCHEDULE_ALIASES = new Set(["@yearly", "@monthly", "@weekly", "@daily", "@hourly"]);

/**
 * Validates syntax using the scheduler's parser family, without creating a
 * schedule. Preserve supported aliases and last-day/name syntax, but exclude
 * empty input and seconds as required by Trigger's schedule contract.
 *
 * @param schedule - The caller-supplied schedule, preserved without rewriting.
 * @returns Whether the expression can be parsed without a seconds field.
 */
export function isValidTaskSchedule(schedule: string): boolean {
  if (
    !schedule.trim() ||
    schedule.split(" ").length > 5 ||
    schedule.trim().split(/\s+/).length > 5
  ) {
    return false;
  }

  if (schedule.startsWith("@")) {
    if (!SCHEDULE_ALIASES.has(schedule)) return false;
  } else {
    const withoutNames = schedule.replace(
      /JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|SUN|MON|TUE|WED|THU|FRI|SAT/gi,
      "",
    );
    // v5 adds hashed/random schedules; the existing scheduler's v4 does not.
    if (!/^[\d\s*,/?L#-]+$/i.test(withoutNames)) return false;
  }

  try {
    CronExpressionParser.parse(schedule, { strict: false });
    return true;
  } catch {
    return false;
  }
}
