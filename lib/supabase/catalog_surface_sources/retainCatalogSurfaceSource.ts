import supabase from "@/lib/supabase/serverClient";
/** Unactivated proposal RPC; never substitute a legacy message write on failure. */
export async function retainCatalogSurfaceSource(
  command: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabase.rpc(
    "retain_catalog_surface_source" as never,
    command as never,
  );
  if (error) throw new Error("Catalog source retention requires reconciliation", { cause: error });
  return data;
}
