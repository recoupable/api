import { oauthScopes } from "../oauthScopes";

/** Derive permissions only from the provider's validated, stored request. */
export function getOAuthConsentRequest(params: Record<string, unknown>, resource: string) {
  if (typeof params.client_id !== "string" || typeof params.scope !== "string")
    throw new Error("Invalid consent request");
  if (params.resource !== undefined && params.resource !== resource)
    throw new Error("Invalid consent resource");
  const requested = [...new Set(params.scope.split(" ").filter(Boolean))];
  if (
    requested.some(
      scope =>
        !Object.hasOwn(oauthScopes, scope) && scope !== "openid" && scope !== "offline_access",
    )
  )
    throw new Error("Invalid consent scope");
  return {
    clientId: params.client_id,
    requested,
    scopes: requested.filter(scope => Object.hasOwn(oauthScopes, scope)),
  };
}
