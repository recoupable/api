import supabase from "../serverClient";

/**
 * Count songs per catalog with parallel head-count queries — exact counts,
 * no row transfer. A failed count reports 0 rather than failing the caller:
 * a missing number should never take a whole profile read down.
 *
 * @param catalogIds - Catalog ids to count songs for
 * @returns Record of catalog id → song count
 */
export async function countCatalogSongs(catalogIds: string[]): Promise<Record<string, number>> {
  if (!catalogIds.length) return {};

  const counts = await Promise.all(
    catalogIds.map(async catalogId => {
      const { count, error } = await supabase
        .from("catalog_songs")
        .select("*", { count: "exact", head: true })
        .eq("catalog", catalogId);

      if (error) {
        console.error("Error counting catalog_songs:", error);
        return [catalogId, 0] as const;
      }
      return [catalogId, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(counts);
}
