import { z } from "zod";
import { disabledCatalogScheduleValues as v } from "./disabledCatalogScheduleValues";
export const disabledCatalogScheduleStateSchema = z
  .object({
    id: v.uuid,
    kind: z.literal("catalog_weekly_report"),
    version: z.literal(1),
    catalog_id: v.uuid,
    organization_id: v.uuid.nullable(),
    revision: v.revision,
    enabled: z.literal(false),
    schedule: v.schedule,
    timezone: v.timezone,
    archived_at: z.string().datetime({ offset: true }).nullable(),
    replayed: z.boolean(),
  })
  .strict();
export type DisabledCatalogScheduleState = z.infer<typeof disabledCatalogScheduleStateSchema>;
