import { z } from "zod";
export const catalogStreamTrackingSchema = z
  .object({
    catalog_id: z.string().uuid(),
    action: z.enum(["status", "enable", "disable", "refresh"]),
  })
  .strict();
/** Validate tracking controls without accepting identity overrides. */
export function validateCatalogStreamTracking(input: unknown) {
  return catalogStreamTrackingSchema.safeParse(input);
}
