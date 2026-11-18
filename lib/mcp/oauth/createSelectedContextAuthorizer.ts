import type { OAuthAccess } from "@/lib/oauth/resolveOAuthAccess";
import { selectedContextSchema } from "@/lib/oauth/selectedContextSchema";

/** Recheck immutable connection attribution and live membership at each domain boundary. */
export function createSelectedContextAuthorizer(
  approved: OAuthAccess,
  token: string,
  verify: (token: string) => Promise<OAuthAccess | undefined>,
) {
  const selected = selectedContextSchema.parse(approved.selectedContext);
  return async (accountId: string, organizationId?: string) => {
    if (
      accountId !== approved.accountId ||
      (organizationId?.toLowerCase() ?? null) !== selected.organizationId
    )
      throw new Error("Workspace access denied");
    const current = await verify(token);
    if (
      !current ||
      current.accountId !== approved.accountId ||
      current.clientId !== approved.clientId ||
      current.grantId !== approved.grantId ||
      current.resource !== approved.resource ||
      !current.scopes.includes("mcp:tools") ||
      JSON.stringify(selectedContextSchema.parse(current.selectedContext)) !==
        JSON.stringify(selected)
    )
      throw new Error("Connection unavailable");
    const { authorizeContextOwner } = await import("@/lib/context/authorizeContextOwner");
    const owner = await authorizeContextOwner(accountId, selected.organizationId ?? undefined);
    if (owner.ownerId.toLowerCase() !== selected.ownerId)
      throw new Error("Workspace access denied");
    return owner;
  };
}
