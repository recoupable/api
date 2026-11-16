import { z } from "zod";
import { disabledCatalogScheduleValues as v } from "./disabledCatalogScheduleValues";
const identity = { id: v.uuid, expected_revision: v.revision };
const cadence = { schedule: v.schedule, timezone: v.timezone };
const command = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      payload: z
        .object({ catalog_id: v.uuid, organization_id: v.uuid.nullable(), ...cadence })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("edit_disabled"),
      payload: z.object({ ...identity, ...cadence }).strict(),
    })
    .strict(),
  z.object({ action: z.literal("disable"), payload: z.object(identity).strict() }).strict(),
  z.object({ action: z.literal("archive"), payload: z.object(identity).strict() }).strict(),
]);
export const disabledCatalogScheduleOperationSchema = z.union([
  z.object({ action: z.literal("read"), id: v.uuid }).strict(),
  z.object({ request_id: v.uuid, command }).strict(),
]);
export type DisabledCatalogScheduleOperation = z.infer<
  typeof disabledCatalogScheduleOperationSchema
>;
export type DisabledCatalogScheduleCommand = z.infer<typeof command>;
