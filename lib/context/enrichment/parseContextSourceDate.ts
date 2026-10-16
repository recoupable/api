import type { ContextDatePrecision } from "./artistResearchTypes";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};
const UNKNOWN = { value: null, precision: "unknown" as const };
const DAY_MS = 86_400_000;
const EARLIEST_YEAR = 1000;
type ParsedDate = { value: string | null; precision: ContextDatePrecision };

function monthNumber(name: string) {
  return String(MONTHS[name.toLowerCase()] ?? 0);
}

function build(year: string, month?: string, day?: string): ParsedDate {
  const y = Number(year);
  if (y < EARLIEST_YEAR) return UNKNOWN;
  if (month === undefined) return { value: year, precision: "year" };
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) return UNKNOWN;
  const mm = String(m).padStart(2, "0");
  if (day === undefined) return { value: `${year}-${mm}`, precision: "month" };
  const d = Number(day);
  if (!Number.isInteger(d) || d < 1 || d > 31 || new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d)
    return UNKNOWN;
  return { value: `${year}-${mm}-${String(d).padStart(2, "0")}`, precision: "day" };
}

function parse(text: string): ParsedDate {
  const iso = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ].*)?)?)?$/.exec(text);
  if (iso) return build(iso[1], iso[2], iso[3]);
  const monthDayYear = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(text);
  if (monthDayYear) return build(monthDayYear[3], monthNumber(monthDayYear[1]), monthDayYear[2]);
  const dayMonthYear = /^(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(text);
  if (dayMonthYear) return build(dayMonthYear[3], monthNumber(dayMonthYear[2]), dayMonthYear[1]);
  const monthYear = /^([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(text);
  if (monthYear) return build(monthYear[2], monthNumber(monthYear[1]));
  return UNKNOWN;
}

/**
 * Reduced-precision ISO date from a provider date string. Unparseable, impossible or implausible dates stay
 * unknown, never guessed. With `notAfter` (an ISO instant such as the retrieval time), a date later than one
 * day past it (timezone slack) is impossible for a publication and also stays unknown.
 */
export function parseContextSourceDate(
  input: string | null | undefined,
  notAfter?: string,
): ParsedDate {
  if (typeof input !== "string" || input.length > 100) return UNKNOWN;
  const parsed = parse(input.trim());
  const limit = notAfter === undefined ? NaN : Date.parse(notAfter) + DAY_MS;
  if (parsed.value === null || !Number.isFinite(limit)) return parsed;
  return parsed.value > new Date(limit).toISOString().slice(0, parsed.value.length)
    ? UNKNOWN
    : parsed;
}
