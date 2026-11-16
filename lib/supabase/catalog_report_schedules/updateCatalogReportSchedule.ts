import type { CatalogScheduleRpc, CatalogScheduleRpcIdentity } from "./CatalogScheduleRpc";
import type { DisabledCatalogScheduleCommand } from "@/lib/catalog/reports/management/disabledCatalogScheduleOperation";
/** Exact disabled-only mutation RPC; SQL owns CAS, receipts and current access checks. */
export async function updateCatalogReportSchedule(
  client: CatalogScheduleRpc,
  identity: CatalogScheduleRpcIdentity,
  requestId: string,
  command: DisabledCatalogScheduleCommand,
) {
  return client.rpc("mutate_catalog_report_schedule", {
    ...identity,
    p_request: requestId,
    p_command: command,
  });
}
