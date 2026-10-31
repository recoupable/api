import type { CatalogScheduleRpc, CatalogScheduleRpcIdentity } from "./CatalogScheduleRpc";
/** Exact Database123 read RPC. No retry, default client, or production schema claim. */
export async function selectCatalogReportSchedule(
  client: CatalogScheduleRpc,
  identity: CatalogScheduleRpcIdentity,
  id: string,
) {
  return client.rpc("read_catalog_report_schedule", { ...identity, p_id: id });
}
