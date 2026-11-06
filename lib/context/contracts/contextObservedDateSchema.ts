import { z } from "zod";

export const contextDatePrecisionSchema = z.enum(["day", "month", "year", "unknown"]);

type KnownPrecision = Exclude<z.infer<typeof contextDatePrecisionSchema>, "unknown">;

const VALUE_SHAPE: Record<KnownPrecision, RegExp> = {
  year: /^(\d{4})$/,
  month: /^(\d{4})-(0[1-9]|1[0-2])$/,
  day: /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
};

/**
 * An observed date with explicit precision.
 *
 * Mirrors Spotify's `release_date`/`release_date_precision` pair as the engine
 * stores it: `unknown` precision carries no value, and a value never claims more
 * precision than its shape supports (a year-only value cannot be `day`). A
 * day-precision value must be a real calendar date and year 0000 is rejected.
 * A throwback with no observed date stays `{ value: null, precision: "unknown" }`.
 */
export const contextObservedDateSchema = z
  .strictObject({
    value: z.string().nullable(),
    precision: contextDatePrecisionSchema,
  })
  .superRefine((date, ctx) => {
    if (date.precision === "unknown") {
      if (date.value !== null)
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Unknown precision has no value",
        });
      return;
    }
    if (date.value === null || !isObservedDateValue(date.value, date.precision))
      ctx.addIssue({
        code: "custom",
        path: ["precision"],
        message: `A ${date.precision}-precision date needs a matching value`,
      });
  });

/**
 * Check that a value has the shape its precision claims and names a real date.
 *
 * @param value - The observed date string.
 * @param precision - The precision the value claims.
 * @returns Whether the value is a real date at exactly that precision.
 */
function isObservedDateValue(value: string, precision: KnownPrecision): boolean {
  const match = VALUE_SHAPE[precision].exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1) return false;
  if (precision !== "day") return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

export type ContextObservedDate = z.infer<typeof contextObservedDateSchema>;
export type ContextDatePrecision = z.infer<typeof contextDatePrecisionSchema>;
