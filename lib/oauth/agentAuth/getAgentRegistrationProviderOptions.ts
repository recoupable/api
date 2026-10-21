import type { Configuration } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

/** Advertise only the explicitly enabled profile and reserve a client without ordinary grants. */
export function getAgentRegistrationProviderOptions(
  config: OAuthRuntimeConfig,
): Pick<Configuration, "clients" | "discovery"> {
  if (!config.agentAuthEnabled) return { clients: [], discovery: {} };
  return {
    clients: [
      {
        client_id: policy.clientId,
        client_name: policy.clientName,
        token_endpoint_auth_method: "none",
        grant_types: [],
        response_types: [],
        redirect_uris: [],
        scope: policy.scope,
      },
    ],
    discovery: {
      agent_auth: {
        // Production has one public discovery URL; other issuers retain their own guide.
        skill:
          config.issuer === "https://api.recoupable.dev/api/oauth"
            ? "https://recoupable.dev/auth.md"
            : `${config.issuer}/auth.md`,
        identity_endpoint: `${config.issuer}/agent/identity`,
        claim_endpoint: `${config.issuer}/agent/identity/claim`,
        identity_types_supported: ["service_auth"],
      },
    },
  };
}
