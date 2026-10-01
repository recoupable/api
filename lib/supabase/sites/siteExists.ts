import { siteTable } from "./siteTable";
/** Avoid loading large generated snapshots at production checkpoints. */
export async function siteExists(id: string) {
  const { data, error } = await siteTable().select("id").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not check site existence");
  return Boolean(data);
}
