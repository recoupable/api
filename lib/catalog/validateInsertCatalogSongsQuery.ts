import { z } from "zod";

const catalogSongInputSchema = z.object({
  catalog_id: z
    .string()
    .min(1, "catalog_id is required")
    .describe(
      "Catalog ID to which the song will be added. Get this from the select_catalogs tool.",
    ),
  isrc: z.string().min(1, "isrc is required").describe("Song ISRC to associate to the catalog"),
});

export const insertCatalogSongsQuerySchema = z.object({
  songs: z
    .array(catalogSongInputSchema)
    .min(1, "songs array is required and must not be empty")
    .describe("Array of songs to add to catalog(s)"),
});

export type InsertCatalogSongsQuery = z.infer<typeof insertCatalogSongsQuerySchema>;
