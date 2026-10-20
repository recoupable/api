import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { AgentRegistration } from "./AgentRegistration";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

/** Issue ordinary provider tokens so MCP authorization and Connected Agents remain authoritative. */
export function createAgentRegistrationGrants(options: {
  config: OAuthRuntimeConfig;
  provider: Provider;
  adapter: AdapterFactory;
  accountExists: (accountId: string) => Promise<boolean>;
  now: () => number;
}) {
  const { config, provider, adapter, now, accountExists } = options;
  return {
    async approve(record: AgentRegistration) {
      const grant = new provider.Grant({ accountId: record.accountId, clientId: policy.clientId });
      grant.jti = record.id;
      grant.exp = record.accessExpiresAt!;
      grant.addResourceScope(config.resource, policy.scope);
      try {
        await grant.save();
        await adapter("RecoupGrant").upsert(
          record.id,
          {
            grantId: record.id,
            accountId: record.accountId,
            clientId: policy.clientId,
            extra: {
              context: "personal",
              subject: record.subject,
              scopes: [policy.scope],
              persistent: false,
              clientName: policy.clientName,
              createdAt: now(),
              expiresAt: record.accessExpiresAt,
            },
          },
          record.accessExpiresAt! - now(),
        );
      } catch (error) {
        await adapter("Grant").revokeByGrantId(record.id);
        throw error;
      }
    },
    async issue(record: AgentRegistration) {
      const [grant, attribution, client] = await Promise.all([
        provider.Grant.find(record.id),
        adapter("RecoupGrant").find(record.id),
        provider.Client.find(policy.clientId),
      ]);
      if (
        record.status !== "approved" ||
        !record.accountId ||
        !record.accessExpiresAt ||
        record.accessExpiresAt <= now() ||
        !grant ||
        grant.isExpired ||
        grant.exp !== record.accessExpiresAt ||
        grant.accountId !== record.accountId ||
        grant.clientId !== policy.clientId ||
        grant.getResourceScope(config.resource) !== policy.scope ||
        !attribution ||
        attribution.accountId !== record.accountId ||
        attribution.grantId !== record.id ||
        attribution.clientId !== policy.clientId ||
        attribution.extra?.context !== "personal" ||
        !client ||
        !(await accountExists(record.accountId))
      )
        throw new AgentRegistrationError("invalid_grant");
      const expiresIn = Math.min(policy.accessSeconds, record.accessExpiresAt - now());
      const token = new provider.AccessToken({
        accountId: record.accountId,
        client,
        grantId: record.id,
        gty: policy.assertionGrant,
        aud: config.resource,
        scope: policy.scope,
        expiresWithSession: false,
      });
      token.exp = now() + expiresIn;
      return {
        access_token: await token.save(),
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: policy.scope,
      };
    },
    async revokeToken(value: string) {
      const token = await provider.AccessToken.find(value);
      if (token?.clientId === policy.clientId && token.gty === policy.assertionGrant)
        await token.destroy();
    },
  };
}
