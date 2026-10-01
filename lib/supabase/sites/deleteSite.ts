import { siteTable } from "./siteTable";
/** Revision-scoped deletion prevents removing a site changed since confirmation. */
export async function deleteSite(id: string, ownerId: string, revision: number) {
  const { data, error } = await siteTable()
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Could not delete site");
  return Boolean(data);
}
