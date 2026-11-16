import { z } from "zod";
import { disabledCatalogScheduleValues as v } from "./disabledCatalogScheduleValues";
export const catalogManagementPrincipalSchema = z.discriminatedUnion("mechanism", [
  z.object({ mechanism: z.literal("recoup_api_key"), key_id: v.uuid }).strict(),
  z
    .object({
      mechanism: z.literal("privy"),
      app_id: z.string().min(1).max(200),
      issuer: z.string().min(1).max(500),
      subject: z.string().min(1).max(300),
    })
    .strict(),
]);
export type CatalogManagementPrincipal = z.infer<typeof catalogManagementPrincipalSchema>;
