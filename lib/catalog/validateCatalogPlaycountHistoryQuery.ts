import { z } from "zod";

export const catalogPlaycountHistoryQuerySchema = z
  .object({
    catalog_id: z.string().uuid(),
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(value => {
        const date = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "since must be a valid UTC date"),
    days: z.coerce.number().int().min(1).max(31),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(25).default(25),
  })
  .strict();
export type CatalogPlaycountHistoryQuery = z.infer<typeof catalogPlaycountHistoryQuerySchema>;

/** Validate bounded comparison input shared by HTTP and MCP, rejecting identity overrides. */
export function validateCatalogPlaycountHistoryQuery(input: unknown) {
  return catalogPlaycountHistoryQuerySchema.safeParse(input);
}
