import { createOAuthConnectionsHandler } from "./connections/createOAuthConnectionsHandler";
import { errors } from "oidc-provider";
import { getOAuthStore } from "../supabase/oauth_provider_artifacts/getOAuthStore";
import { selectAccounts } from "../supabase/accounts/selectAccounts";
import { createOAuthAdapter } from "./createOAuthAdapter";
import { createOAuthNodeHandler } from "./createOAuthNodeHandler";
import { createRecoupOAuthProvider } from "./createRecoupOAuthProvider";
import { createOAuthConsentHandler } from "./consent/createOAuthConsentHandler";
import { loadOAuthConfig } from "./loadOAuthConfig";
import { resolveOAuthAccount } from "./resolveOAuthAccount";
import { resolveOAuthAccess } from "./resolveOAuthAccess";
import { createOAuthConnections } from "./createOAuthConnections";

let runtime:
  | {
      handler: ReturnType<typeof createOAuthNodeHandler>;
      verifyAccess: (bearer: string) => ReturnType<typeof resolveOAuthAccess>;
      connections: ReturnType<typeof createOAuthConnections>;
    }
  | undefined;

/** Initialize once per process; durable state and signing identity survive process replacement. */
export function getOAuthRuntime() {
  if (runtime) return runtime;
  const config = loadOAuthConfig();
  const store = getOAuthStore();
  const adapter = createOAuthAdapter({
    namespace: config.issuer,
    indexKey: config.indexKey,
    cipher: config.cipher,
    store,
    invalidGrant: () => new errors.InvalidGrant(),
  });
  const provider = createRecoupOAuthProvider(
    config,
    adapter,
    async id => (await selectAccounts(id)).length === 1,
  );
  const consent = createOAuthConsentHandler({
    config,
    provider,
    adapter,
    resolveIdentity: resolveOAuthAccount,
  });
  const connections = createOAuthConnections(config, store, adapter);
  const manageConnections = createOAuthConnectionsHandler({
    origin: config.consentOrigin,
    resolveIdentity: resolveOAuthAccount,
    connections,
  });
  const callback = provider.callback();
  const handler = createOAuthNodeHandler(config.issuer, async (req, res) => {
    const match = /^\/interaction\/([A-Za-z0-9_-]+)$/.exec(req.url?.split("?")[0] ?? "");
    if (/^\/connections(?:\/|\?|$)/.test(req.url ?? "")) await manageConnections(req, res);
    else if (match) await consent(req, res, match[1]);
    else await callback(req, res);
  });
  runtime = {
    connections,
    handler,
    verifyAccess: bearer =>
      resolveOAuthAccess(
        {
          provider,
          adapter,
          resource: config.resource,
          accountExists: async id => (await selectAccounts(id)).length === 1,
        },
        bearer,
      ),
  };
  return runtime;
}
