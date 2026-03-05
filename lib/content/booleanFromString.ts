import { z } from "zod";

/**
 * Parses a string query param as a boolean. Only "true" → true; everything else → false.
 * z.coerce.boolean() would treat any non-empty string (including "false") as true.
 */
export const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform(v => v === "true");
