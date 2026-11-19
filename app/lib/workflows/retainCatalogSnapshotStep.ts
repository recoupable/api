import { FatalError } from "workflow";
import { retainCatalogSnapshot } from "@/lib/intelligent-ui/retention/retainCatalogSnapshot";
/** Default off; requires separately reviewed proposal, authority adapter and fenced enrollment. */
export async function retainCatalogSnapshotStep(
  writer: unknown,
  scope: Parameters<typeof retainCatalogSnapshot>[1],
  prepared: unknown,
) {
  "use step";
  if (process.env.CATALOG_SURFACE_RETENTION_ENABLED !== "true")
    return { state: "not-enabled" as const };
  if (process.env.NODE_ENV !== "development")
    throw new FatalError("Catalog retention is development-only");
  try {
    const { retainCatalogSurfaceSource } = await import(
      "@/lib/supabase/catalog_surface_sources/retainCatalogSurfaceSource"
    );
    return await retainCatalogSnapshot(writer, scope, prepared, retainCatalogSurfaceSource);
  } catch {
    throw new FatalError("Catalog source retention incomplete; no automatic retry or fallback");
  }
}
