import { z } from "zod";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { resolveCatalogReportScope } from "../resolveCatalogReportScope";
import { disabledCatalogScheduleValues as v } from "./disabledCatalogScheduleValues";
import { disabledCatalogScheduleOperationSchema } from "./disabledCatalogScheduleOperation";
import { catalogManagementPrincipalSchema } from "./catalogManagementPrincipal";
import { parseCatalogScheduleRpcResult } from "./parseCatalogScheduleRpcResult";
import { selectCatalogReportSchedule } from "@/lib/supabase/catalog_report_schedules/selectCatalogReportSchedule";
import { updateCatalogReportSchedule } from "@/lib/supabase/catalog_report_schedules/updateCatalogReportSchedule";
import type { CatalogScheduleRpc } from "@/lib/supabase/catalog_report_schedules/CatalogScheduleRpc";
const scopeSchema = z.object({ catalog_id: v.uuid, organization_id: v.uuid.nullable() }).strict();

/** Internal/unwired. Reauthenticates each management request; never creates an execution grant. */
export async function manageDisabledCatalogSchedule(
  request: NextRequest,
  scopeInput: unknown,
  operationInput: unknown,
  transport: CatalogScheduleRpc,
) {
  const scope = scopeSchema.safeParse(scopeInput);
  const parsed = disabledCatalogScheduleOperationSchema.safeParse(operationInput);
  if (!scope.success || !parsed.success)
    return errorResponse("Invalid disabled catalog operation", 400);
  const selectedScope = {
    catalog_id: scope.data.catalog_id,
    organization_id: scope.data.organization_id,
  };
  const operation = parsed.data;
  const mutation = "command" in operation ? operation : null;
  if (
    mutation?.command.action === "create" &&
    (mutation.command.payload.catalog_id !== scope.data.catalog_id ||
      mutation.command.payload.organization_id !== scope.data.organization_id)
  ) {
    return errorResponse("Catalog schedule scope mismatch", 400);
  }
  try {
    const observed = await resolveCatalogReportScope(request, {
      kind: "catalog_weekly_report",
      ...scope.data,
    });
    if (observed instanceof NextResponse) return observed;
    const actor = v.uuid.safeParse(observed.principal.actorAccountId);
    if (
      !actor.success ||
      actor.data !== observed.effectiveAccountId ||
      observed.accountAccess.basis !== "self"
    )
      return errorResponse("Original management identity unavailable", 401);
    const p = observed.principal;
    const principal = catalogManagementPrincipalSchema.safeParse(
      p.mechanism === "recoup_api_key"
        ? { mechanism: p.mechanism, key_id: p.keyId }
        : { mechanism: p.mechanism, app_id: p.appId, issuer: p.issuer, subject: p.subject },
    );
    if (!principal.success) return errorResponse("Original management identity unavailable", 401);
    const identity = { p_actor: actor.data, p_principal: principal.data };
    const id =
      "id" in operation
        ? operation.id
        : mutation!.command.action === "create"
          ? undefined
          : mutation!.command.payload.id;
    if (id !== undefined) {
      const current = parseCatalogScheduleRpcResult(
        await selectCatalogReportSchedule(transport, identity, id),
        selectedScope,
        id,
      );
      if (current instanceof NextResponse) return current;
      if (current.replayed) return errorResponse("Invalid catalog schedule read response", 502);
      if (!mutation) return current;
      // Do not compare current revision here: an exact receipt may replay an older snapshot.
      // SQL owns fresh principal/access checks, CAS and replay authorization atomically.
    }
    const { command, request_id: requestId } = mutation!;
    const result = parseCatalogScheduleRpcResult(
      await updateCatalogReportSchedule(transport, identity, requestId, command),
      selectedScope,
      id,
    );
    if (result instanceof NextResponse) return result;
    const expectedRevision =
      command.action === "create" ? 1 : command.payload.expected_revision + 1;
    if (
      result.revision !== expectedRevision ||
      (command.action === "archive" ? result.archived_at === null : result.archived_at !== null) ||
      ((command.action === "create" || command.action === "edit_disabled") &&
        (result.schedule !== command.payload.schedule ||
          result.timezone !== command.payload.timezone))
    ) {
      return errorResponse("Invalid catalog schedule mutation response", 502);
    }
    return result;
  } catch {
    return errorResponse("Could not manage disabled catalog schedule", 500);
  }
}
