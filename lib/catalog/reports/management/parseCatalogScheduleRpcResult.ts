import { isCatalogManagementJson } from "./isCatalogManagementJson";
import type { CatalogScheduleRpcResult } from "@/lib/supabase/catalog_report_schedules/CatalogScheduleRpc";
import { errorResponse } from "@/lib/networking/errorResponse";
import { disabledCatalogScheduleStateSchema } from "./disabledCatalogScheduleState";
/** Never expose database messages, detail, hints, or partially valid output. */
export function parseCatalogScheduleRpcResult(
  result: CatalogScheduleRpcResult,
  scope: { catalog_id: string; organization_id: string | null },
  id?: string,
) {
  if (result?.error) {
    const code = result.error.code;
    const status =
      code === "42501"
        ? 403
        : code === "40001"
          ? 409
          : code === "22023" || code === "22003"
            ? 400
            : 500;
    return errorResponse("Catalog schedule management failed", status);
  }
  if (!isCatalogManagementJson(result?.data)) {
    return errorResponse("Invalid catalog schedule storage response", 502);
  }
  const parsed = disabledCatalogScheduleStateSchema.safeParse(result.data);
  if (
    !parsed.success ||
    parsed.data.catalog_id !== scope.catalog_id ||
    parsed.data.organization_id !== scope.organization_id ||
    (id !== undefined && parsed.data.id !== id)
  ) {
    return errorResponse("Invalid catalog schedule storage response", 502);
  }
  return parsed.data;
}
