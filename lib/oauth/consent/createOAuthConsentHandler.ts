import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { oauthLaunchScopes } from "../oauthLaunchScopes";
import type { OAuthConsentBinding } from "./createOAuthConsentTickets";
import { resolveSelectedContext } from "./resolveSelectedContext";
import { listOAuthWorkspaces } from "./listOAuthWorkspaces";
import { createOAuthConsentTickets } from "./createOAuthConsentTickets";
import { readOAuthConsentBody } from "./readOAuthConsentBody";
import { getOAuthConsentRequest } from "./getOAuthConsentRequest";
import { setOAuthConsentCors } from "./setOAuthConsentCors";
import { approveOAuthInteraction } from "./approveOAuthInteraction";
import { OAuthStorageUnavailableError } from "../OAuthStorageUnavailableError";

/** Handle browser-bound consent; call only behind the canonical issuer Node boundary. */
export function createOAuthConsentHandler(options: {
  config: OAuthRuntimeConfig;
  provider: Provider;
  adapter: AdapterFactory;
  resolveIdentity: (token: string) => Promise<{ accountId: string; subject: string }>;
}) {
  const { config, provider, adapter, resolveIdentity } = options;
  const tickets = createOAuthConsentTickets(adapter);
  return async (req: IncomingMessage, res: ServerResponse, uid: string) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    if (!setOAuthConsentCors(req, res, config.consentOrigin)) {
      reply(403, { error: "untrusted_origin" });
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "POST") {
      reply(405, { error: "method_not_allowed" });
      return;
    }
    try {
      const details = await provider.interactionDetails(req, res);
      if (details.uid !== uid || !["login", "consent"].includes(details.prompt.name))
        throw new Error();
      if (!req.headers.origin) {
        const destination = new URL(config.consentUrl);
        destination.searchParams.set("interaction", uid);
        res.writeHead(303, { Location: destination.href });
        res.end();
        return;
      }
      const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
      if (!bearer) {
        reply(401, { error: "login_required" });
        return;
      }
      const identity = await resolveIdentity(bearer[1]);
      const { params } = details;
      const { clientId, requested, scopes } = getOAuthConsentRequest(params, config.resource);
      const binding: OAuthConsentBinding = {
        ...identity,
        uid,
        clientId,
        resource: config.resource,
        scopes,
      };
      if (req.method === "GET") {
        const client = await provider.Client.find(clientId);
        if (!client) throw new Error();
        const query = new URL(req.url ?? "", config.resource).searchParams;
        const version = query.get("consent_version");
        if (version !== null && version !== "2") throw new Error();
        if (version === null && (query.has("workspace_kind") || query.has("organization_id")))
          throw new Error();
        let selectedPreview = {};
        if (version === "2") {
          if (!scopes.includes("mcp:tools")) throw new Error();
          const selection = {
            ...(query.has("workspace_kind") ? { workspace_kind: query.get("workspace_kind") } : {}),
            ...(query.has("organization_id")
              ? { organization_id: query.get("organization_id") }
              : {}),
          };
          if (Object.keys(selection).length)
            binding.selectedContext = await resolveSelectedContext(
              identity.accountId,
              scopes,
              selection,
            );
          selectedPreview = {
            consent_version: 2,
            workspaces: await listOAuthWorkspaces(identity.accountId),
            ...(binding.selectedContext ? { selectedContext: binding.selectedContext } : {}),
          };
        }
        reply(200, {
          ...selectedPreview,
          ...(version !== "2" || binding.selectedContext
            ? { csrf: await tickets.issue(binding) }
            : {}),
          clientId: binding.clientId,
          clientName: client.clientName ?? "Unnamed agent",
          clientVerified: false,
          accountId: identity.accountId,
          context: "personal",
          expiresIn: 300,
          accessDurationDays: null,
          permissions: scopes.map(scope => ({
            scope,
            description:
              version === "2"
                ? "Use Context tools to read and save briefs, ingest research, review releases, and plan or run Context jobs in one selected workspace. Jobs may contact external research services."
                : oauthLaunchScopes[scope as keyof typeof oauthLaunchScopes],
          })),
        });
        return;
      }
      const body = await readOAuthConsentBody(req);
      if ("error" in body) {
        reply(body.status, { error: body.error });
        return;
      }
      if ("consent_version" in body) {
        const { decision: _decision, csrf: _csrf, consent_version: _version, ...selection } = body;
        binding.selectedContext = await resolveSelectedContext(
          identity.accountId,
          scopes,
          selection,
        );
      }
      await tickets.consume(body.csrf, binding);
      if (body.decision === "deny") {
        const redirectUrl = await provider.interactionResult(
          req,
          res,
          { error: "access_denied" },
          { mergeWithLastSubmission: false },
        );
        reply(200, { redirectUrl });
        return;
      }
      const redirectUrl = await approveOAuthInteraction(
        provider,
        adapter,
        req,
        res,
        binding,
        requested,
      );
      reply(200, { redirectUrl });
    } catch (error) {
      if (error instanceof OAuthStorageUnavailableError) {
        console.error("OAuth consent storage unavailable", {
          event: "oauth_consent_storage_unavailable",
        });
      }
      reply(400, { error: "invalid_or_expired_interaction" });
    }
  };
}
