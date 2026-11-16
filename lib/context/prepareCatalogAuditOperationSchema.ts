import { z } from "zod";

/** Preparation selects one existing authorized brief; callers cannot supply evidence. */
export const prepareCatalogAuditOperationSchema = z.strictObject({
  action: z.literal("prepare_catalog_audit"),
  brief_id: z.uuid(),
  organization_id: z.uuid().optional(),
});
