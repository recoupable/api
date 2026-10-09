import { selectEnabledCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/selectEnabledCatalogStreamTracking";
import { startCatalogStreamRun } from "@/lib/catalog/startCatalogStreamRun";
/** Cursor-bounded dispatcher; duplicate starts are eliminated by database claims. */
export async function dispatchCatalogStreamsStep(after?: string) {
  "use step";
  const page = await selectEnabledCatalogStreamTracking(after);
  let failed = 0;
  for (const subscription of page) {
    try {
      await startCatalogStreamRun(subscription.catalog_id);
    } catch {
      failed++;
    }
  }
  return { next: page.length === 100 ? page[99].catalog_id : null, failed };
}
