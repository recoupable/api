import { extractOrgId } from "@/lib/recoupable/extractOrgId";
import type { VerificationEvidence } from "./VerificationEvidence";

/**
 * Disabled design gate: identity continuity is necessary, never sufficient.
 * Callers must freshly obtain current evidence from shared auth, not a request body.
 * No result authorizes dispatch until a resource authorization contract exists.
 */
export function assessExecutionRecovery(
  original: VerificationEvidence,
  current: VerificationEvidence,
  cloneUrl: string | null,
): {
  allowed: false;
  reason:
    | "principal_changed"
    | "authorization_observation_changed"
    | "routing_organization_unverified"
    | "resource_authorization_contract_missing";
} {
  const a = original.principal;
  const b = current.principal;
  if (
    a.actorAccountId !== b.actorAccountId ||
    a.mechanism !== b.mechanism ||
    (a.mechanism === "privy" &&
      b.mechanism === "privy" &&
      (a.appId !== b.appId || a.issuer !== b.issuer || a.subject !== b.subject)) ||
    (a.mechanism === "recoup_api_key" && b.mechanism === "recoup_api_key" && a.keyId !== b.keyId)
  )
    return { allowed: false, reason: "principal_changed" };

  if (
    original.effectiveAccountId !== current.effectiveAccountId ||
    JSON.stringify(original.accountAccess) !== JSON.stringify(current.accountAccess) ||
    JSON.stringify(original.organizationAccess) !== JSON.stringify(current.organizationAccess)
  )
    return { allowed: false, reason: "authorization_observation_changed" };

  const routedOrganization = cloneUrl ? extractOrgId(cloneUrl) : null;
  if (routedOrganization && routedOrganization !== current.organizationAccess?.organizationId) {
    return { allowed: false, reason: "routing_organization_unverified" };
  }
  return { allowed: false, reason: "resource_authorization_contract_missing" };
}
