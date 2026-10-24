import { z } from "zod";
import { catalogStreamHistoryQuerySchema } from "@/lib/catalog/validateCatalogStreamHistoryQuery";

/** Selected host workspace/catalog and explicit reporting query; actor is authentication-derived. */
export const catalogSurfaceRequestSchema = z
  .object({
    workspaceId: z.string().uuid(),
    query: catalogStreamHistoryQuerySchema,
  })
  .strict();
export type CatalogSurfaceRequest = z.infer<typeof catalogSurfaceRequestSchema>;
