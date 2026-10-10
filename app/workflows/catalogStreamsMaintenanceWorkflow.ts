import { dispatchCatalogStreamsStep } from "./dispatchCatalogStreamsStep";
/** Paginate all enabled subscriptions outside the cron request timeout. */
export async function catalogStreamsMaintenanceWorkflow() {
  "use workflow";
  let after: string | undefined;
  let failed = 0;
  do {
    const page = await dispatchCatalogStreamsStep(after);
    failed += page.failed;
    after = page.next ?? undefined;
  } while (after);
  return { failed };
}
