import { errors } from "oidc-provider";
import { getOAuthStore } from "../supabase/oauth_provider_artifacts/getOAuthStore";
import { selectAccounts } from "../supabase/accounts/selectAccounts";
import { createOAuthAdapter } from "./createOAuthAdapter";
import { createOAuthNodeHandler } from "./createOAuthNodeHandler";
import { createRecoupOAuthProvider } from "./createRecoupOAuthProvider";
import { createOAuthConsentHandler } from "./consent/createOAuthConsentHandler";
import { loadOAuthConfig } from "./loadOAuthConfig";
import { resolveOAuthAccount } from "./resolveOAuthAccount";

let runtime: ReturnType<typeof createOAuthNodeHandler> | undefined;

/** Initialize once per process; durable state and signing identity survive process replacement. */
export function getOAuthRuntime() {
  if (runtime) return runtime;
  const config = loadOAuthConfig();
  const adapter = createOAuthAdapter({
    namespace: config.issuer,
    indexKey: config.indexKey,
    cipher: config.cipher,
    store: getOAuthStore(),
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
  const callback = provider.callback();
  runtime = createOAuthNodeHandler(config.issuer, async (req, res) => {
    const match = /^\/interaction\/([A-Za-z0-9_-]+)$/.exec(req.url?.split("?")[0] ?? "");
    if (match) await consent(req, res, match[1]);
    else await callback(req, res);
  });
  return runtime;
}
