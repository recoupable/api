import supabase from "@/lib/supabase/serverClient";

// PostgREST IN filters ride the URL; match the existing catalog lookup batch bound.
const CHUNK_SIZE = 200;

/** Read bounded metadata batches; callers validate the complete owner-bound result set. */
export async function selectRetainedContextMetadata(
  table: "context_source_versions" | "context_sources",
  ownerId: string,
  ids: string[],
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
    const batch = ids.slice(offset, offset + CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .select(
        table === "context_source_versions"
          ? "id,owner_id,source_id,fingerprint,removed_at"
          : "id,owner_id,withdrawn_at",
      )
      .eq("owner_id", ownerId)
      .in("id", batch)
      .is(table === "context_source_versions" ? "removed_at" : "withdrawn_at", null)
      .limit(batch.length);
    if (error || !Array.isArray(data)) throw new Error("Retained Context sources unavailable");
    rows.push(...data);
  }
  return rows;
}
