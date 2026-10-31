import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { errorResponse } from "@/lib/networking/errorResponse";
import { catalogReportIntentSchema } from "./catalogReportIntent";
import type { CatalogReportScopeObservation } from "./CatalogReportScopeObservation";

/** Unwired: reverify this request and its exact workspace/catalog link on every call. */
export async function resolveCatalogReportScope(
  request: NextRequest,
  input: unknown,
): Promise<CatalogReportScopeObservation | NextResponse> {
  const parsed = catalogReportIntentSchema.safeParse(input);
  if (!parsed.success) return errorResponse("Invalid catalog report intent", 400);
  const { catalog_id: catalogId, organization_id: organizationId } = parsed.data;
  try {
    const auth = await validateAuthContext(request, {
      organizationId,
      includeVerificationEvidence: true,
    });
    if (auth instanceof NextResponse) return auth;
    const evidence = auth.verificationEvidence;
    // This boundary accepts no account override and cannot impersonate a stored creator.
    if (
      !evidence ||
      !evidence.principal.actorAccountId ||
      evidence.effectiveAccountId !== auth.accountId ||
      evidence.principal.actorAccountId !== auth.accountId ||
      evidence.accountAccess.basis !== "self"
    ) {
      return errorResponse("Current principal evidence unavailable", 401);
    }
    if (
      auth.orgId !== organizationId ||
      (organizationId !== null
        ? evidence.organizationAccess?.organizationId !== organizationId
        : evidence.organizationAccess !== null)
    ) {
      return errorResponse("Workspace evidence does not match requested workspace", 403);
    }
    const ownerAccountId = organizationId ?? auth.accountId;
    const catalogs = await selectAccountCatalogs([ownerAccountId], { catalogIds: [catalogId] });
    if (
      !catalogs.some(catalog => catalog.id === catalogId && catalog.owners.includes(ownerAccountId))
    ) {
      return errorResponse("Catalog unavailable in requested workspace", 403);
    }
    return {
      catalogId,
      organizationId,
      ownerAccountId,
      effectiveAccountId: auth.accountId,
      principal: evidence.principal,
      accountAccess: evidence.accountAccess,
      organizationAccess: evidence.organizationAccess,
      observedAt: new Date().toISOString(),
      provenance: { authentication: "validateAuthContext", catalogLink: "account_catalogs" },
      executionAuthorization: "not_granted",
    };
  } catch {
    return errorResponse("Could not observe catalog report authority", 500);
  }
}
