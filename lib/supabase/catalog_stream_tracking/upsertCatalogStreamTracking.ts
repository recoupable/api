import { randomUUID } from "node:crypto";
import supabase from "../serverClient";
/** Rotate revision on enable/pause to fence prior workflows; observations remain retained. */
export async function upsertCatalogStreamTracking(input: {
  catalog_id: string;
  owner_id: string;
  enabled: boolean;
}) {
  const { data, error } = await supabase
    .from("catalog_stream_tracking")
    .upsert(
      { ...input, revision: randomUUID(), updated_at: new Date().toISOString() },
      { onConflict: "catalog_id" },
    )
    .select()
    .single();
  if (error) throw new Error("Unable to update catalog stream tracking");
  return data;
}
