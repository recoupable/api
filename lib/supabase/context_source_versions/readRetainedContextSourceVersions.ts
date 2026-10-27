import { z } from "zod";
import supabase from "@/lib/supabase/serverClient";
import { sameCatalogUuid } from "@/lib/context/sameCatalogUuid";

const versionSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  source_id: z.uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  removed_at: z.null(),
});
const sourceSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  withdrawn_at: z.null(),
});

/** Metadata-only service read. Caller must authorize and recheck the actor's workspace. */
export async function readRetainedContextSourceVersions(ownerId: string, versionIds: string[]) {
  z.uuid().parse(ownerId);
  const ids = [
    ...new Set(
      z
        .array(z.uuid())
        .min(1)
        .max(1000)
        .parse(versionIds)
        .map(id => id.toLowerCase()),
    ),
  ];
  const versions = await supabase
    .from("context_source_versions")
    .select("id,owner_id,source_id,fingerprint,removed_at")
    .eq("owner_id", ownerId)
    .in("id", ids)
    .is("removed_at", null)
    .limit(ids.length);
  if (versions.error) throw new Error("Retained Context sources unavailable");
  const rows = z.array(versionSchema).max(1000).parse(versions.data);
  if (
    rows.length !== ids.length ||
    new Set(rows.map(row => row.id.toLowerCase())).size !== ids.length ||
    rows.some(row => !sameCatalogUuid(row.owner_id, ownerId) || !ids.includes(row.id.toLowerCase()))
  )
    throw new Error("Retained Context sources unavailable");
  const sourceIds = [...new Set(rows.map(row => row.source_id.toLowerCase()))];
  const sources = await supabase
    .from("context_sources")
    .select("id,owner_id,withdrawn_at")
    .eq("owner_id", ownerId)
    .in("id", sourceIds)
    .is("withdrawn_at", null)
    .limit(sourceIds.length);
  if (sources.error) throw new Error("Retained Context sources unavailable");
  const active = z.array(sourceSchema).max(1000).parse(sources.data);
  if (
    active.length !== sourceIds.length ||
    new Set(active.map(row => row.id.toLowerCase())).size !== sourceIds.length ||
    active.some(
      row => !sameCatalogUuid(row.owner_id, ownerId) || !sourceIds.includes(row.id.toLowerCase()),
    )
  )
    throw new Error("Retained Context sources unavailable");
  const byId = new Map(rows.map(row => [row.id.toLowerCase(), row]));
  return ids.map(id => ({ id, fingerprint: byId.get(id)!.fingerprint }));
}
