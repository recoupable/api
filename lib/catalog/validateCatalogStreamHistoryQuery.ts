import { z } from "zod";
import { catalogPlaycountHistoryQuerySchema } from "./validateCatalogPlaycountHistoryQuery";

export const catalogStreamHistoryQuerySchema = catalogPlaycountHistoryQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(366),
});
export type CatalogStreamHistoryQuery = z.infer<typeof catalogStreamHistoryQuerySchema>;

/** Validate up to a year of saved stream history without widening public playcount reads. */
export function validateCatalogStreamHistoryQuery(input: unknown) {
  return catalogStreamHistoryQuerySchema.safeParse(input);
}
