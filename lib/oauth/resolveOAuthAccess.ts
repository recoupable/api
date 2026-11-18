import type { SelectedContext } from "./selectedContextSchema";
import { oauthGrantContextSchema } from "./oauthGrantContextSchema";
import type { AdapterFactory, Provider } from "oidc-provider";

export type OAuthAccess = {
  accountId: string;
  clientId: string;
  grantId: string;
  scopes: string[];
  expiresAt: number;
  resource: string;
  context: "personal";
  selectedContext?: SelectedContext;
};

/** Check every authority binding, including the current grant, before accepting a bearer. */
export async function resolveOAuthAccess(
  options: {
    provider: Provider;
    adapter: AdapterFactory;
    resource: string;
    accountExists: (id: string) => Promise<boolean>;
  },
  bearer: string,
): Promise<OAuthAccess | undefined> {
  const { provider, adapter, resource, accountExists } = options;
  const token = await provider.AccessToken.find(bearer);
  if (!token || token.isExpired || token.aud !== resource || !token.grantId) return undefined;
  const [grant, attribution] = await Promise.all([
    provider.Grant.find(token.grantId),
    adapter("RecoupGrant").find(token.grantId),
  ]);
  if (
    !grant ||
    grant.isExpired ||
    !attribution ||
    grant.accountId !== token.accountId ||
    grant.clientId !== token.clientId ||
    attribution.accountId !== token.accountId ||
    attribution.clientId !== token.clientId ||
    attribution.grantId !== token.grantId ||
    !(await accountExists(token.accountId))
  )
    return undefined;
  const authority = oauthGrantContextSchema.safeParse(attribution.extra);
  if (!authority.success) return undefined;
  const scopes = (token.scope ?? "").split(" ").filter(Boolean);
  const approved = attribution.extra.scopes;
  const resourceScopes = new Set(grant.getResourceScope(resource).split(" "));
  if (
    !Array.isArray(approved) ||
    scopes.length === 0 ||
    scopes.some(scope => !approved.includes(scope) || !resourceScopes.has(scope))
  )
    return undefined;
  const selectedContext =
    authority.data.context === "selected_context_v1" ? authority.data.selectedContext : undefined;
  if (
    selectedContext &&
    (!scopes.includes("mcp:tools") ||
      (selectedContext.kind === "personal" &&
        selectedContext.ownerId !== token.accountId.toLowerCase()))
  )
    return undefined;
  return {
    ...(selectedContext ? { selectedContext } : {}),
    accountId: token.accountId,
    clientId: token.clientId,
    grantId: token.grantId,
    scopes,
    expiresAt: token.exp!,
    resource,
    context: "personal",
  };
}
