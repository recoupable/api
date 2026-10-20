import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { AgentClaimIdentity } from "./AgentRegistration";
import type { createAgentRegistrationService } from "./createAgentRegistrationService";

export type AgentRegistrationReply = (status: number, body?: unknown) => void;
export type AgentRegistrationHandlerOptions = {
  config: OAuthRuntimeConfig;
  service: ReturnType<typeof createAgentRegistrationService>;
  resolveIdentity: (bearer: string) => Promise<AgentClaimIdentity>;
};
