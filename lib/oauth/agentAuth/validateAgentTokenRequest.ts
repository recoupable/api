import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import { AgentRegistrationError } from "./AgentRegistrationError";

export type AgentTokenRequest = { scope?: string; resource?: string };

/** Token exchanges cannot expand the approved personal scope or target another resource. */
export function validateAgentTokenRequest(config: OAuthRuntimeConfig, request: AgentTokenRequest) {
  if (request.scope !== undefined && request.scope !== policy.scope)
    throw new AgentRegistrationError("invalid_scope");
  if (request.resource !== undefined && request.resource !== config.resource)
    throw new AgentRegistrationError("invalid_target");
}
