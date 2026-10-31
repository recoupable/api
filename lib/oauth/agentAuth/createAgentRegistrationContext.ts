import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { OAuthStore } from "../OAuthStore";
import { createOAuthConsentTickets } from "../consent/createOAuthConsentTickets";
import { createAgentRegistrationStore } from "./createAgentRegistrationStore";
import { createAgentRegistrationGrants } from "./createAgentRegistrationGrants";
import { createAgentAssertions } from "./createAgentAssertions";
import { AgentRegistrationError } from "./AgentRegistrationError";
import type { AgentClaimIdentity, AgentRegistration } from "./AgentRegistration";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

/** Share verified bindings and storage across the registration operations. */
export function createAgentRegistrationContext(options: {
  config: OAuthRuntimeConfig;
  store: OAuthStore;
  adapter: AdapterFactory;
  provider: Provider;
  accountExists: (accountId: string) => Promise<boolean>;
  now?: () => number;
}) {
  const { config, adapter } = options;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const store = createAgentRegistrationStore(config, options.store);
  const binding = (record: AgentRegistration, identity: AgentClaimIdentity) => ({
    uid: record.id,
    accountId: identity.accountId,
    subject: identity.subject,
    clientId: policy.clientId,
    resource: config.resource,
    scopes: [policy.scope],
  });
  const readAttempt = async (attempt: string, identity: AgentClaimIdentity) => {
    if (!/^cla_[A-Za-z0-9_-]{43}$/.test(attempt)) throw new AgentRegistrationError("invalid_claim");
    const saved = await store.find("user_code", attempt);
    if (!saved || saved.record.claimExpiresAt <= now() || saved.record.status !== "pending")
      throw new AgentRegistrationError("invalid_claim");
    if (!identity.verifiedEmails.includes(saved.record.email))
      throw new AgentRegistrationError("account_mismatch", 403);
    return saved;
  };
  return {
    config,
    adapter,
    now,
    store,
    binding,
    readAttempt,
    accountExists: options.accountExists,
    grants: createAgentRegistrationGrants({ ...options, now }),
    assertions: createAgentAssertions(config, now),
    tickets: createOAuthConsentTickets(adapter),
  };
}
export type AgentRegistrationContext = ReturnType<typeof createAgentRegistrationContext>;
