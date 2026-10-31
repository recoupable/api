import type { Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

/** The Node dispatcher implements these grants at the provider's existing token endpoint. */
export function configureAgentRegistrationDiscovery(
  provider: Provider,
  config: OAuthRuntimeConfig,
) {
  if (!config.agentAuthEnabled) return;
  provider.use(async (ctx, next) => {
    await next();
    if (ctx.oidc.route === "discovery" && ctx.body && typeof ctx.body === "object") {
      const body = ctx.body as { grant_types_supported?: string[] };
      body.grant_types_supported = [
        ...(body.grant_types_supported ?? []),
        policy.claimGrant,
        policy.assertionGrant,
      ];
    }
  });
}
