import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { oauthLaunchScopes } from "../oauthLaunchScopes";
import { createOAuthConsentTickets } from "./createOAuthConsentTickets";
import { readOAuthConsentBody } from "./readOAuthConsentBody";
import { getOAuthConsentRequest } from "./getOAuthConsentRequest";
import { setOAuthConsentCors } from "./setOAuthConsentCors";
import { approveOAuthInteraction } from "./approveOAuthInteraction";

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
      const binding = {
        ...identity,
        uid,
        clientId,
        resource: config.resource,
        scopes,
      };
      if (req.method === "GET") {
        const client = await provider.Client.find(clientId);
        if (!client) throw new Error();
        reply(200, {
          csrf: await tickets.issue(binding),
          clientId: binding.clientId,
          clientName: client.clientName ?? "Unnamed agent",
          clientVerified: false,
          accountId: identity.accountId,
          context: "personal",
          expiresIn: 300,
          accessDurationDays: 30,
          permissions: scopes.map(scope => ({
            scope,
            description: oauthLaunchScopes[scope as keyof typeof oauthLaunchScopes],
          })),
        });
        return;
      }
      const body = await readOAuthConsentBody(req);
      if ("error" in body) {
        reply(body.status, { error: body.error });
        return;
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
    } catch {
      reply(400, { error: "invalid_or_expired_interaction" });
    }
  };
}
