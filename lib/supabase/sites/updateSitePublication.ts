import { siteTable } from "./siteTable";
import type { Site } from "@/lib/sites/schema";
/** Publication changes do not invalidate the draft revision held by an active builder. */
export async function updateSitePublication(
  site: Site,
  changes: Pick<Site, "published" | "published_at"> & Partial<Pick<Site, "artist_id">>,
) {
  const { data, error } = await siteTable()
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", site.id)
    .eq("owner_id", site.owner_id)
    .eq("revision", site.revision)
    .select()
    .maybeSingle();
  if (error) throw new Error("Could not publish site");
  return data as Site | null;
}
