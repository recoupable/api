import type { CatalogManagementPrincipal } from "@/lib/catalog/reports/management/catalogManagementPrincipal";
import type { DisabledCatalogScheduleCommand } from "@/lib/catalog/reports/management/disabledCatalogScheduleOperation";
export interface CatalogScheduleRpcIdentity {
  p_actor: string;
  p_principal: CatalogManagementPrincipal;
}
export interface CatalogScheduleRpcResult {
  data: unknown;
  error: { code?: string } | null;
}
/** Injected trusted transport only. No generated production types or live binding. */
export interface CatalogScheduleRpc {
  rpc(
    name: "read_catalog_report_schedule",
    args: CatalogScheduleRpcIdentity & { p_id: string },
  ): PromiseLike<CatalogScheduleRpcResult>;
  rpc(
    name: "mutate_catalog_report_schedule",
    args: CatalogScheduleRpcIdentity & {
      p_request: string;
      p_command: DisabledCatalogScheduleCommand;
    },
  ): PromiseLike<CatalogScheduleRpcResult>;
}
