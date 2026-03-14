import { z } from "zod";

export const getCatalogSongsQuerySchema = z.object({
  catalog_id: z
    .string()
    .min(1, "catalog_id parameter is required")
    .describe(
      "The unique identifier of the catalog to query songs for. Get this from the select_catalogs tool.",
    ),
  criteria: z
    .string()
    .min(1, "criteria parameter is required")
    .describe(
      "The search criteria or theme to filter songs by (e.g., 'Halloween party songs', 'workout music', 'romantic ballads')",
    ),
});

export type GetCatalogSongsQuery = z.infer<typeof getCatalogSongsQuerySchema>;
