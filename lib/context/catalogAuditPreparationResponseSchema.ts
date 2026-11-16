import { z } from "zod";
import { catalogCaseSnapshotSchema } from "./catalogCaseSnapshotSchema";

/** An unsaved workpaper, not an executed audit or authorization for external action. */
export const catalogAuditPreparationResponseSchema = z.strictObject({
  state: z.literal("prepared"),
  persisted: z.literal(false),
  external_actions: z.literal("unsupported"),
  snapshot: catalogCaseSnapshotSchema,
});
