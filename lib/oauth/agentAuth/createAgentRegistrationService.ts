import { createAgentRegistrationContext } from "./createAgentRegistrationContext";
import { registerAgentIdentity } from "./registerAgentIdentity";
import { decideAgentClaim } from "./decideAgentClaim";
import { pollAgentClaim } from "./pollAgentClaim";
import { validateAgentTokenRequest, type AgentTokenRequest } from "./validateAgentTokenRequest";
import { AgentRegistrationError } from "./AgentRegistrationError";
import type { AgentClaimIdentity } from "./AgentRegistration";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import { oauthLaunchScopes } from "../oauthLaunchScopes";

/** Compose the user-verified personal read registration operations. */
export function createAgentRegistrationService(
  options: Parameters<typeof createAgentRegistrationContext>[0],
) {
  const context = createAgentRegistrationContext(options);
  const { config, store, assertions, grants, readAttempt, tickets, binding, now } = context;
  return {
    create: (loginHint: string) => registerAgentIdentity(context, loginHint),
    decide: (attempt: string, input: unknown, identity: AgentClaimIdentity) =>
      decideAgentClaim(context, attempt, input, identity),
    poll: (claimToken: string, request: AgentTokenRequest) =>
      pollAgentClaim(context, claimToken, request),
    async load(attempt: string, identity: AgentClaimIdentity) {
      const { record } = await readAttempt(attempt, identity);
      return {
        csrf: await tickets.issue(binding(record, identity)),
        accountId: identity.accountId,
        context: "personal",
        clientName: policy.clientName,
        expiresIn: record.claimExpiresAt - now(),
        accessDurationSeconds: policy.connectionSeconds,
        permissions: [{ scope: policy.scope, description: oauthLaunchScopes[policy.scope] }],
      };
    },
    async exchange(assertion: string, request: AgentTokenRequest) {
      validateAgentTokenRequest(config, request);
      const id = await assertions.verify(assertion);
      const saved = await store.find("id", id);
      if (!saved) throw new AgentRegistrationError("invalid_grant");
      return grants.issue(saved.record);
    },
    revokeToken: grants.revokeToken,
  };
}
