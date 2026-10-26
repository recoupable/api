import { z } from "zod";

/** Internal read intent only: scheduling and caller-supplied authority are not accepted. */
export const catalogReportIntentSchema = z
  .object({
    kind: z.literal("catalog_weekly_report"),
    catalog_id: z.string().uuid(),
    organization_id: z.string().uuid().nullable(),
  })
  .strict();

export type CatalogReportIntent = z.infer<typeof catalogReportIntentSchema>;
