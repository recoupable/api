import { z } from "zod";

export const contextDatePrecisionSchema = z.enum(["day", "month", "year", "unknown"]);

const VALUE_SHAPE: Record<
  Exclude<z.infer<typeof contextDatePrecisionSchema>, "unknown">,
  RegExp
> = {
  year: /^\d{4}$/,
  month: /^\d{4}-(?:0[1-9]|1[0-2])$/,
  day: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
};

/**
 * An observed date with explicit precision.
 *
 * Mirrors Spotify's `release_date`/`release_date_precision` pair as the engine
 * stores it: `unknown` precision carries no value, and a value never claims more
 * precision than its shape supports (a year-only value cannot be `day`). A
 * throwback with no observed date stays `{ value: null, precision: "unknown" }`.
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
    if (date.value === null || !VALUE_SHAPE[date.precision].test(date.value))
      ctx.addIssue({
        code: "custom",
        path: ["precision"],
        message: `A ${date.precision}-precision date needs a matching value`,
      });
  });

export type ContextObservedDate = z.infer<typeof contextObservedDateSchema>;
export type ContextDatePrecision = z.infer<typeof contextDatePrecisionSchema>;
