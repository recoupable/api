import { CronExpressionParser } from "cron-parser";

const SCHEDULE_ALIASES = new Set(["@yearly", "@monthly", "@weekly", "@daily", "@hourly"]);
const FIELD_NAMES = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const;
const MONTH_NAMES = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const WEEKDAY_NAMES = "sun mon tue wed thu fri sat".split(" ");
const FIELD_CHARACTERS = [
  /^[,*\d/-]+$/,
  /^[,*\d/-]+$/,
  /^[?,*\dL/-]+$/,
  /^[,*\d/-]+$/,
  /^[?,*\dL#/-]+$/,
];

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
    schedule.length > 1024 ||
    schedule.split(" ").length > 5 ||
    schedule.trim().split(/\s+/).length > 5
  ) {
    return false;
  }

  try {
    if (schedule.startsWith("@")) {
      if (!SCHEDULE_ALIASES.has(schedule)) return false;
      CronExpressionParser.parse(schedule, { strict: false });
      return true;
    }

    const fields = schedule.trim().split(/\s+/);
    fields.unshift(...Array<string>(5 - fields.length).fill("*"));
    const validationFields = fields.map((raw, index) => {
      const names = index === 3 ? MONTH_NAMES : index === 4 ? WEEKDAY_NAMES : [];
      const field = raw.replace(/[a-z]{3}/gi, name => {
        const value = names.indexOf(name.toLowerCase());
        return value < 0 ? name : String(value + (index === 3 ? 1 : 0));
      });
      if (!FIELD_CHARACTERS[index].test(field)) throw new Error("Invalid cron field");
      if (field === "*" || field === "?") return field;
      if (field.includes("#")) {
        if (/[,/-]/.test(field)) throw new Error("Invalid nth weekday combination");
        return field;
      }

      // Validate each list member before merging its values. Provider v4 accepts
      // overlapping lists; v5 rejects their duplicates in the final field.
      const values = new Set<number | string>();
      for (const member of field.split(",")) {
        if (!member) throw new Error("Empty cron list member");
        const isolated = ["*", "*", "*", "*", "*"];
        // v4 also accepts standalone weekday L. Use a v5-compatible last-day
        // token only for validation; the original expression remains intact.
        isolated[index] = index === 4 && member === "L" ? "0L" : member;
        const parsed = CronExpressionParser.parse(isolated.join(" "), { strict: false });
        for (const value of parsed.fields[FIELD_NAMES[index]].values) {
          values.add(index === 4 && typeof value === "number" ? value % 7 : value);
        }
      }
      return [...values].join(",");
    });
    // v4 applies its explicit month/day check only when the parsed month list
    // has one entry, including duplicates. Deduplication must not tighten that
    // legacy acceptance rule. All original month members were validated above.
    if (fields[3].includes(",") && !validationFields[3].includes(",")) {
      validationFields[3] = "*";
    }
    // Cross-field validation still runs, e.g. February cannot use only day31.
    // This temporary expression never replaces the stored/provider expression.
    const parsed = CronExpressionParser.parse(validationFields.join(" "), { strict: false });
    // Provider v4 rejects impossible explicit month/day pairs even with a
    // restricted weekday; v5's either-day matching can otherwise admit them.
    const months = parsed.fields.month.values;
    const firstDay = parsed.fields.dayOfMonth.values[0];
    if (months.length === 1 && typeof firstDay === "number") {
      const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][months[0] - 1];
      if (firstDay > maxDay) return false;
    }
    return true;
  } catch {
    return false;
  }
}
