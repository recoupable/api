import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthConsentBinding } from "./createOAuthConsentTickets";

/** Persist attribution before resuming; failed approvals revoke the whole new grant. */
export async function approveOAuthInteraction(
  provider: Provider,
  adapter: AdapterFactory,
  req: IncomingMessage,
  res: ServerResponse,
  binding: OAuthConsentBinding,
  requested: string[],
) {
  const { accountId, clientId, subject, resource, scopes } = binding;
  const grant = new provider.Grant({ accountId, clientId });
  grant.addResourceScope(resource, scopes);
  grant.addOIDCScope(requested);
  const grantId = await grant.save();
  try {
    const client = await provider.Client.find(clientId);
    await adapter("RecoupGrant").upsert(
      grantId,
      {
        accountId,
        clientId,
        grantId,
        extra: {
          subject,
          context: "personal",
          scopes,
          persistent: true,
          clientName: client?.clientName ?? "Unnamed agent",
          createdAt: Math.floor(Date.now() / 1000),
          expiresAt: grant.exp,
        },
      },
      30 * 86400,
    );
    return await provider.interactionResult(
      req,
      res,
      {
        login: { accountId, remember: false },
        consent: { grantId },
      },
      { mergeWithLastSubmission: false },
    );
  } catch {
    await adapter("Grant").revokeByGrantId(grantId);
    throw new Error("OAuth approval unavailable");
  }
}
